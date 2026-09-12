---
type: Architecture Review
title: Assessment of the backend-less design
description: A judgement on whether Google-Sheets-as-backend is the right bet for this app, where the implementation fails the bet, and a ranked list of improvements that keep it.
tags: [architecture, assessment, review, trade-offs, local-first]
status: draft
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: AppEffects
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService
  - id: redirect
    resource: ../../src/services/security/redirect-security.service.ts
    title: RedirectSecurityService
  - id: popup
    resource: ../../src/services/security/popup-security.service.ts
    title: PopupSecurityService
  - id: known
    resource: /constraints/known-issues.md
    title: Known issues (this bundle)
---

> **This is a judgement, not a description.** Everything here comes from reading the
> repository at commit `78b5109`; nothing was measured, profiled, or reproduced at runtime,
> except the token-endpoint probes cited in §4.
> The descriptive concepts in this bundle are the factual record — this document argues
> about them. Trust tier: unverified.

# Verdict in one paragraph

**The backend-less bet is correct and worth keeping.** For a household expense tracker, using
the user's own spreadsheet as the datastore buys data ownership, zero operating cost, a free
permission model, and a second UI (Sheets itself) that no custom backend would ever match.
The problems in this codebase are **not** caused by the absence of a server. They are caused
by the client treating Sheets as if it were a private, transactional, single-writer
database — when it is a shared, human-editable, eventually-consistent document with no
identity, no transactions, and no conditional writes. Every serious defect traces back to
that one mismatch. Fixing it does not require a backend; it requires the app to become
**local-first** rather than a thin remote-procedure UI.

# What the design gets right

Worth stating plainly, because the recommendations below must not erode any of it.

| Property | Why it matters |
|---|---|
| **The user owns the data** | The spreadsheet outlives the app. Uninstalling loses nothing, and there is no custodial or privacy burden on the developer. |
| **Zero operating cost and zero ops** | No servers, no database, no backups, no migrations to run for other people, no on-call. |
| **Google's sharing model comes free** | Household access control is "share the spreadsheet". No user accounts, no roles, no invitation flow, no permission code — a very large amount of software that does not have to exist. |
| **Sheets is a legitimate second UI** | Pivot tables, formulas, charts, CSV export, history. The `isInDebt` column storing the *amount* rather than a boolean is a good example of designing *for* that second UI — it makes `SUM(E:E)` meaningful. |
| **Static hosting fits the model** | Push-to-deploy, free, no runtime configuration, and hash routing makes it work anywhere. |
| **PWA + offline shell** | Right call for "log a coffee at the till". |

These are real and durable. A conventional client/server rewrite would trade all of them for
correctness properties that, as shown below, can mostly be obtained without it.

# Where the implementation fails the bet

## 1. Records have no identity, so everything is addressed positionally

This is the root cause, and it produces at least three of the entries in
[known issues](/constraints/known-issues.md).

An [`Expense`](/domain/expense.md) has no id. Deletion therefore: re-reads the newest 100
rows, finds a match by comparing **every field** (`isExpenseEqual`), and deletes that **array
index** as a sheet row index.[^effects] The consequences are structural, not incidental:

- rows older than the newest 100 cannot be deleted, and the optimistic UI reports success;
- any concurrent edit in Google Sheets between the read and the delete removes the **wrong
  row** — and this design *invites* concurrent editing, via the "Open Spreadsheet" menu item;
- two genuinely identical expenses are indistinguishable.

The same pattern appears for categories, where the store's array index is used directly as a
sheet row index, which is only valid immediately after a fresh load.

**This is the highest-value fix in the entire codebase, and it is small.** Add a sixth column
holding a client-generated id (ULID or UUID) written at insert time. Deletion becomes: read
the id column alone (`values.get` on `F:F` — one column, cheap, and complete, so the 100-row
window disappears), find the exact index, delete it. Duplicate ambiguity vanishes; the
concurrent-edit window shrinks to the round-trip and, more importantly, becomes *detectable*
because you can confirm the id at the target index before deleting.

Sheets' `DeveloperMetadata` (metadata attached to a row, which moves with the row through
insertions and deletions) is arguably the more correct mechanism and would not consume a
visible column — **worth evaluating, but verify the delete-by-metadata path before committing
to it**, since row deletion takes a range rather than a data filter. The id column is the
option I would ship first: it is obvious in the sheet, survives manual editing, and needs no
API features beyond what is already in use.

## 2. Two read paths, two date encodings, one of them on an unversioned endpoint

Filtered reads go through the [Visualization Query endpoint](/interfaces/gviz-query.md); the
delete lookup goes through [`values.get`](/interfaces/google-sheets-api.md). The two return
dates in **different encodings**, so the codebase carries two independent date converters and
a regex-based JSONP unwrapper for a charting API that is not versioned alongside Sheets. They
have already been burned once by a response-shape change (commit `cdc85e6`).

gviz earns its place today because it filters server-side. But the premise deserves
challenging: **is server-side filtering actually needed at this data scale?** A household
logging a handful of expenses a day produces a few thousand rows a year — a few hundred KB of
JSON for an entire history. That is a one-time sync, not a per-interaction cost.

Collapsing to a single read path with a local cache would:

- delete the gviz dependency, the regex unwrapper, and one of the two date encodings;
- make [statistics](/flows/statistics.md) instant instead of a network round-trip per month
  tab, and make multi-month or year-over-year views possible at all;
- make offline reads genuinely work, instead of merely deferring
  ([today, offline reads park on `whenOnline`](/flows/offline-and-updates.md) and the cache
  holds nothing);
- remove the row-mapper crashes on empty cells, because one mapper is easier to harden than
  two.

The cost is honest and should be stated: the cache goes stale whenever someone edits the
sheet directly, and Sheets offers no cheap "has this changed?" signal (Drive's `modifiedTime`
would require an additional scope). The local-first answer is to revalidate on visibility
change plus an explicit pull-to-refresh, and to accept eventual consistency — which is what
the architecture already implies but does not yet admit.

## 4. Long sessions need a refresh token, and Google ties refresh tokens to a secret

`RedirectSecurityService` performs an OAuth **authorization-code exchange from the browser**,
posting `client_secret` to Google's token endpoint.[^redirect] As a result
[the client secret is compiled into the published bundle](/constraints/security-posture.md)
and is readable by anyone who opens the site.

The obvious ways to remove it do not survive contact with Google or with the product:

- **PKCE without a secret is not available.** For a Web application client, Google's token
  endpoint rejects both the `authorization_code` grant (even with a `code_verifier`) and the
  `refresh_token` grant when the secret is omitted:
  `400 invalid_request: "client_secret is missing."` (probed against this project's client
  id). The secret-less client types — iOS, Android, UWP, Chrome — accept only redirect targets
  a hosted web page cannot receive.
- **The GIS token model is not a viable replacement.** `PopupSecurityService` needs no
  secret,[^popup] but the token model issues no refresh token, supports only a popup, and
  Google expects renewal "from a user-driven event such as a button press". For a mobile PWA
  that means an interactive sign-in whenever the app is opened more than about an hour after
  the last token — unacceptable for the core use case. Renewal triggered from the HTTP
  interceptor also runs outside a user gesture, which installed iOS PWAs block; the git
  history suggests this is why the popup flow was replaced by the redirect flow in `6226fc2`.

Sessions that survive between app opens require a refresh token; Google issues one only
through the code flow; the code flow for a web client requires the secret. **The secret
stays, so the question is what it is worth to an attacker.** On its own, little: the redirect
URI allowlist means codes are only ever delivered to this app's own origin. What it does
enable is redeeming a *stolen* `refresh_token`, because the refresh grant involves no
redirect at all. The threat to defend is token exfiltration — XSS, a compromised dependency,
device access — not the secret itself.

Hardening that keeps the current UX:

- build the authorization URL directly instead of through `initCodeClient`, and add PKCE
  (`code_challenge` / `code_verifier`) to close interception of the code on the redirect
  page — the GIS code client does not accept PKCE parameters;
- that also retires the self-hosted copy of the GIS library (`src/scripts/client.js`), which
  Google states is not a supported use and which receives no security fixes; `revoke` is a
  plain POST;
- add a Content Security Policy (a `<meta>` tag, given static hosting) to narrow the XSS path
  to the refresh token in `localStorage`.

Alternatives weighed and not recommended today:

- **A token-exchange proxy** moves the secret off the client, but on a `*.github.io` origin
  the refresh token must still be held by the client (a cross-site httpOnly cookie is blocked
  by Safari), so a stolen token remains redeemable through the proxy. It pays off only with a
  custom domain that puts app and proxy on the same site.
- **A silent `response_type=token&prompt=none` redirect** needs neither secret nor refresh
  token, but Google strongly discourages the implicit flow, and it depends on the Google
  session surviving inside an installed iOS PWA — unverified.
- **A Capacitor wrapper with native client types** gives genuine secret-less PKCE with refresh
  tokens, at the cost of becoming a store-distributed app.

Two console settings bound session length regardless of flow: a consent screen left in
**Testing** status issues refresh tokens that expire after 7 days, and `spreadsheets` is a
sensitive scope, so publishing to production for external users requires verification.

Separately, the requested scope is `auth/spreadsheets` — **read and write to every spreadsheet
the user owns**, to operate on one file they chose. `drive.file` plus the Google Picker
narrows it to the selected document. That is optional for personal use and close to mandatory
if this is ever published for strangers, because the consent screen is where a "free expense
app" earns or loses trust.

## 5. Writes have no offline story

Reads defer politely until the network returns; writes simply fail and the error is logged
where nobody sees it.[^effects] For an expense tracker this inverts the priority: the moment
you most need to record a purchase is standing at a till with one bar of signal.

The absence of a server makes an outbox *more* important, not less, because there is nothing
to accept the write on your behalf. Queue pending mutations in IndexedDB, drain them on
`online$`, and reconcile on the next sync.

Note how this composes: **client-generated ids (§1) make queued writes replay-safe, and the
local cache (§2) is what the queued write updates optimistically.** These are not three
projects. They are one.

## 6. Concurrency is invited but unhandled

The design deliberately supports multiple people (`data_<name>` tabs in a shared spreadsheet)
and encourages direct editing. Yet the category reorder rewrites the **entire**
`categories!A1:B<n>` range with `values.update` — a textbook lost-update generator if two
people reorder, and an O(n) write for what is semantically a one-row move.[^svc]

Sheets' `batchUpdate` has a `moveDimension` request that expresses "move row i to position j"
directly: O(1), far smaller, and it composes with someone else's concurrent edit instead of
stamping over it. Worth noting that `Category.id` is already **vestigial for ordering** —
order is carried by row position and nothing sorts by `id` on read — so moving the row *is*
the operation, and column B could be dropped or repurposed.

## 7. No schema version marker

**The data outlives the deployment.** That is the whole point of the design,
and it creates an obligation the app has not yet met. There is no schema version anywhere in
the spreadsheet, and setup reuses existing tabs without reconciling their shape, so a future
layout change silently misreads every existing user's history. A version marker (a hidden
`_meta` tab, or developer metadata on the spreadsheet) plus an upgrade step in setup is cheap
insurance that gets more expensive to add the longer it is deferred.

# Should there be a backend?

**No — not for the current scope, and a backend would not fix the actual problems.**

A thin proxy (a Cloudflare Worker, say) would hide the client secret and centralise quota. It
would do nothing for record identity, concurrent edits, offline writes, or schema migration —
those are all fixed in the client, which is where the work belongs. Even for §4 it buys little
while the app lives on `github.io`, because the refresh token would still sit in the client;
it becomes worth its ops cost only together with a custom domain.

Google Apps Script bound to the spreadsheet is the interesting middle ground: no server you
operate, runs as the user, and could express compound operations closer to atomically. The
cost is a per-user deployment step, which would wreck the current "paste a URL and go" setup.
Not worth it today.

Reconsider the whole question if any of these become true:

- more than a handful of users share one deployment (Sheets quota is per project, on the
  order of a few hundred requests per minute — fine for a household, a ceiling for a product);
- you need server-side aggregation, scheduled reports, or notifications;
- you need genuinely atomic multi-row operations;
- you need to keep any credential secret.

# Ranked recommendations

Effort is a rough order of magnitude, not an estimate.

## P0 — correctness, cheap, do these first

| # | Change | Fixes | Effort |
|---|---|---|---|
| 1 | **Id column + id-based delete** (§1) | 3 known issues at once: the 100-row limit, wrong-row deletion, duplicate ambiguity | S |
| 3 | **Harden the redirect flow: hand-built auth URL with PKCE, drop self-hosted GIS, add CSP** (§4) | code interception, an unsupported GIS copy, the XSS path to the refresh token | S |

## P1 — architecture, medium effort, high leverage

| # | Change | Fixes | Effort |
|---|---|---|---|
| 5 | **One read path + a local cache** (§2) | gviz fragility, two date encodings, slow statistics, hollow offline mode | M |
| 6 | **`moveDimension` for category reorder** (§6) | lost updates on concurrent reorder | S |
| 7 | **Schema version + migration step in setup** (§7) | silent misreads of existing users' data after any layout change | S |

## P2 — product-shaped, do when the above lands

| # | Change | Fixes | Effort |
|---|---|---|---|
| 8 | **Write outbox draining on `online$`** (§5) | the core use case in poor signal | M |
| 9 | **`drive.file` + Picker instead of full `spreadsheets` scope** (§4) | consent-screen trust, if this is ever public | M |

# The through-line

Items 1, 5, and 8 are one architectural move: stop treating Sheets as a database being
queried per interaction, and start treating it as a **sync target for a local-first client**.
Records get stable ids, the client holds the authoritative working copy, reads come from the
cache, writes queue and drain, and the spreadsheet becomes what it is genuinely good at being
— durable, user-owned, human-readable storage that another program happens to also write to.

That is the architecture the backend-less bet was always implying. The current code is one
honest refactor away from it.

[^effects]: AppEffects
[^svc]: SpreadsheetService
[^redirect]: RedirectSecurityService
[^popup]: PopupSecurityService
