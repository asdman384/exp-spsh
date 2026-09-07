---
type: Playbook
title: Troubleshooting
description: Symptom-to-cause table for the failures this architecture actually produces, and where to look first.
tags: [operations, troubleshooting, debugging, playbook]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: Effect error handling
  - id: logger
    resource: ../../src/logger.ts
    title: On-page logger
  - id: dev
    resource: ../../.github/rules/development.md
    title: Pitfalls and notes
---

# First move, always

Open the **on-page log overlay** (the `memory` icon). Every effect's `catchError` still
calls `log(e)` with the full, unredacted error, and the interceptor logs every `METHOD
url` — the overlay remains the only place to see *why* something failed, even now that a
snackbar tells the user *that* it failed.[^logger] Since 2026-09-08 (item 10 fixed, see
[known issues](/constraints/known-issues.md)), the 7 remote-calling effects
(`loadCategories$`, `addCategory$`, `deleteCategory$`, `updateCategoryPosition$`,
`addExpense$`, `deleteExpense$`, `loadExpenses$`) open a `MatSnackBar` with one of 7 fixed,
plain-language strings on failure — but that toast never contains the raw error, an HTTP
status, or which request failed, only a generic "couldn't do X" per effect. The overlay is
still the only place with the actual `HttpErrorResponse`/thrown value. The 4
localStorage-only persist effects and the setup pipeline still have **no** `catchError` at
all and remain fully silent — see [known issues](/constraints/known-issues.md) items 20 and
9. The overlay has a copy button, so a user report can include the trace.

Add `?logger=1` to the URL to also get **NgRx DevTools** and see which action stalled.

# Symptoms

| Symptom | Likely cause | Check |
|---|---|---|
| Spinner never stops on the setup page | the setup pipeline has no `catchError`; the request failed | log overlay; usually no edit rights on the spreadsheet, or offline |
| "cannot read spreadsheet id." | the pasted value matched neither regex | paste the full `docs.google.com/spreadsheets/d/<id>/edit` URL |
| Redirected to `#/setup` on every visit | `isSetupReady` fails: `spreadsheetId` or `categoriesSheetId` missing | localStorage keys; a `logout()` clears **all** storage |
| Login loops back to Google | redirect URI mismatch, or consent screen in testing mode (7-day refresh tokens) | Cloud console: authorized redirect URI must equal `origin + pathname` |
| Everything 401s after a while | refresh token revoked or expired | log out and back in; see [authentication](/flows/authentication.md) |
| "Invalid response format from Google Sheets API" | the gviz endpoint returned a non-JSON page (auth failure, wrong `gid`) or changed its envelope | [gviz interface](/interfaces/gviz-query.md) |
| Expense table silently keeps old rows after a reload | a row with an empty category or amount cell threw inside the row mapper | inspect the sheet for blank cells in A or C |
| Deleted expense reappears | the row was older than the newest 100 and never actually deleted | [delete flow](/flows/delete-expense.md) |
| Category order reverts after a "Couldn't save the new order" toast | the reorder write failed — this is now expected/correct behaviour: `updateCategoryPosition$` rolls back and re-shows the toast (item 1, fixed 2026-09-08) | log overlay for the underlying cause; [known issues](/constraints/known-issues.md) |
| Retrying an action that already failed once this session does nothing at all — no toast, no spinner, no network call | that effect's stream `catchError`-completed on its first failure and NgRx does not resubscribe on completion, so the effect no longer reacts to its trigger action | reload the page; [known issues](/constraints/known-issues.md) item 21 |
| App will not boot at all, blank page | corrupt JSON in a localStorage key throws during store construction | clear site data for the origin |
| Stale UI after a rebuild in dev | the service worker is enabled in development | unregister the worker in DevTools > Application, hard reload |
| iOS PWA crashes or fails to cache | the postinstall ngsw patch was not applied | re-run `npm install` without `--ignore-scripts`; check the script's regex match output |
| Times shifted by an hour on old rows | the serial-number reverse conversion uses today's timezone offset | [date encoding](/domain/spreadsheet-layout.md) |
| A person's name is truncated in the selector | the UI shows `title.split('_')[1]`, and the name contains `_` | rename the tab |

# Where errors go to die

Updated 2026-09-08 (see [known issues](/constraints/known-issues.md) items 1, 10, 20, 21):
every effect's `catchError` still returns `EMPTY` after logging, and `SpreadsheetService`
never inspects status codes.[^effects] For the 7 remote-calling effects there is now a
toast and an `AppState.lastError` record — but the toast copy is generic ("Couldn't save
that expense. Please try again."), never the actual status/message, so **diagnosis of the
cause still starts from the log overlay or the network tab, never from the UI.** The 4
localStorage-only persist effects and the setup pipeline remain fully silent, with no
toast, no error state, and no failure action at all — for those, the old advice still
applies without qualification.

[^logger]: On-page logger
[^effects]: Effect error handling
