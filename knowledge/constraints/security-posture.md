---
type: Constraint
title: Security posture
description: What a backend-less design implies here - a client secret in the bundle, an API key in every URL, and tokens in localStorage - stated plainly with the mitigations that do exist.
tags: [constraints, security, oauth, secrets]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: redirect
    resource: ../../src/services/security/redirect-security.service.ts
    title: RedirectSecurityService token exchange
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: API key usage
  - id: wf
    resource: ../../.github/workflows/webpack.yml
    title: keys.json assembly in CI
---

These are properties of the current design, recorded so that nobody rediscovers them by
surprise. They are not necessarily defects — for a personal, self-hosted expense tracker the
trade-offs may be deliberate — but any change in audience should revisit them.

# 1. `CLIENT_SECRET` ships in the browser bundle

The redirect strategy performs the OAuth **authorization-code exchange from the browser**,
posting `client_id` + `client_secret` to `oauth2.googleapis.com/token`.[^redirect] The secret
comes from `keys.json`, which CI writes from a repository secret and the bundler then inlines
into the published JavaScript.[^wf]

Consequences: the secret is public to anyone who opens the published site; it cannot be
"rotated to a safe state" without removing this flow. The standard alternatives are PKCE
with a public client (no secret) or a small token-exchange backend — either is a design
change, not a configuration change. The already-implemented
[`PopupSecurityService`](/flows/authentication.md) needs no client secret and is the smaller
step of the two.

# 2. `API_KEY` is sent on every Sheets request

Every `SpreadsheetService` call appends `key: keys.API_KEY`.[^svc] API keys are not secrets
in the same sense, but they are quota-bearing and should be **restricted by HTTP referrer and
by API** in the Cloud console; otherwise the published key can be used to consume the
project's Sheets quota.

# 3. Tokens live in `localStorage`

`token`, `redirect-token`, and `refresh-token` are stored as plain JSON on the origin
([storage](/interfaces/local-storage.md)). Any XSS on the origin reads them, and the
**refresh token is long-lived**. The mitigations that exist: `logout()` revokes the access
token and clears storage, and `Token` expires access tokens 60 seconds early.

# 4. "Logged in" is a localStorage flag

`isLoggedIn` checks for a stored `user` object, not a valid session. It is a routing
convenience, not an authorization boundary — the real boundary is Google's, enforced per
request. Nothing sensitive is gated client-side, so this is sound as long as nobody adds
local-only "protected" data.

# 5. Scope is broad

The app requests `https://www.googleapis.com/auth/spreadsheets` — **read and write to all of
the user's spreadsheets**, not just the selected one. Google offers no per-file variant of
this scope short of the Drive file-picker flow, so narrowing means adopting
`drive.file` + Picker.

# What is done well

- `secureParseDate` validates the gviz date strings with an anchored regex instead of
  `eval`-ing them ([date encoding](/domain/spreadsheet-layout.md)).
- The gviz `tq` string interpolates only numbers derived from `Date` getters, so user text
  never reaches the query.
- Spreadsheet ranges are `encodeURIComponent`-escaped.
- `keys.json` is gitignored and injected only at build time.
- The service worker never caches API responses, so expense data is not persisted in the
  Cache Storage.
- The toolbar's external spreadsheet link uses `rel="noopener noreferrer"`.

[^redirect]: RedirectSecurityService token exchange
[^svc]: API key usage
[^wf]: keys.json assembly in CI
