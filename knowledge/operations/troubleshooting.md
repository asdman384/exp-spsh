---
type: Playbook
title: Troubleshooting
description: Symptom-to-cause table for the failures this architecture actually produces, and where to look first.
tags: [operations, troubleshooting, debugging, playbook]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: Effect error handling
  - id: logger
    resource: ../../src/logger.ts
    title: On-page logger
  - id: dev
    resource: ../../.claude/rules/development.md
    title: Pitfalls and notes
---

# First move

Open the **log overlay** (the `memory` icon at the bottom).[^logger] It has the raw error
from every `catchError`, every `METHOD url` from the interceptor, and a copy button for bug
reports. Toasts only say *that* something failed, with fixed wording; setup failures and
localStorage write failures show nothing at all.[^effects]

Add `?logger=1` before the `#` to also load NgRx DevTools and see which action stalled.

# Symptoms

| Symptom | Likely cause | Check |
|---|---|---|
| Setup spinner stops, nothing happens | the setup pipeline failed and only logged | overlay; no edit rights, offline, or Picker/`APP_ID` problem ([setup](../flows/initial-setup.md)) |
| Setup fails on the deployed site but works locally | CI builds with an empty `APP_ID` | [known issues](../constraints/known-issues.md) #29 |
| Redirected to `#/setup` on every visit | `spreadsheetId` or `categoriesSheetId` missing | localStorage; logout clears it |
| Login loops back to Google | redirect URI mismatch, or consent screen in testing mode (7-day refresh tokens) | Cloud console: redirect URI must equal `origin + pathname` |
| Everything fails after a while | refresh token revoked or expired | log out and in ([authentication](../flows/authentication.md)) |
| "Couldn't load your expenses" toast | any `loadExpenses` failure, including `Invalid response format from Google Sheets API` (gviz returned HTML: auth failure, wrong `gid`, or format change) or a malformed date cell | overlay; [gviz](../interfaces/gviz-query.md) |
| Deleted expense reappears with a toast | older than the newest 100 rows, or the request failed | [delete flow](../flows/delete-expense.md) |
| Category order reverts with a toast | the reorder write failed; rollback is intended | overlay |
| A setup value reverts after reload, no toast | a `localStorage` write threw once; that persist effect has stopped for the session | overlay; known issues #28 |
| Outbox badge never clears | a drain precondition fails (offline, signed out, no spreadsheet id) or requests keep failing `retryable`/`auth` | overlay lines `OutboxEffects: precondition …`; [write outbox](../architecture/write-outbox.md) |
| "…belongs to a different spreadsheet" notice | a queued record was made for another spreadsheet | Retry after switching back, or Discard |
| Queued expenses survive logout | the IndexedDB outbox is not cleared | DevTools → Application → IndexedDB → delete `exp-spsh-outbox` |
| Blank page, app will not boot | corrupt JSON in a localStorage key | clear site data |
| Source edits never appear with `watch` running | a production build left a hashed `index.html` in `dist/exp-spsh` | restart `watch` ([build and serve](build-and-serve.md)) |
| Stale UI after a rebuild in dev | the service worker runs in development | unregister it or hard-reload |
| `ERR_INTERNET_DISCONNECTED` offline despite a prior visit | `ngsw.json` has empty `urls` (glob written as `/exp-spsh/…`) or URLs lack `/exp-spsh/` | inspect `ngsw.json` ([PWA](../architecture/pwa-and-service-worker.md)) |
| iOS PWA crashes or fails to cache | the postinstall ngsw patch was not applied | reinstall without `--ignore-scripts`; check the script's match output |
| A person's name is truncated in selectors | the UI shows `title.split('_')[1]` and the name contains `_` | rename the tab |

[^logger]: On-page logger
[^effects]: Effect error handling
