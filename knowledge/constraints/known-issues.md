---
type: Constraint
title: Known issues and rough edges
description: Remaining defects and fragilities identified by reading the code, each with its trigger and the file to look at. Only currently-open issues are listed; item numbers are intentionally non-sequential because other docs cite specific items by number.
tags: [constraints, known-issues, defects, technical-debt]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: AppEffects
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService
  - id: outboxeffects
    resource: ../../src/@state/outbox.effects.ts
    title: OutboxEffects
---

Everything below was derived by reading the code in this repository and has **not been
reproduced at runtime**. Treat each as a lead, not a verdict.

# Correctness

| # | Issue | Trigger | Where |
|---|---|---|---|
| 2 | **Delete only sees the newest 100 rows.** `loadLastExpenses(title, 100)` caps what the effect can search: an expense older than the 100 most recent can't be located, so `deleteExpense$` throws `cannot find expense in the last 100 rows`, which triggers the rollback path (the optimistic removal is reverted and a toast reports the failure) — the delete visibly fails rather than silently succeeding. Needs a real lookup (by row content or a stable id) to actually support deleting older rows. | deleting an expense older than the 100 most recent | `app.effects.ts`, `deleteExpense$` |
| 3 | **Row deletion is positional.** The array index from a fresh read is used as the sheet row index. A concurrent edit or a manual sort in Google Sheets between read and delete removes the wrong row. Same root cause as item 2; a real fix needs a stable row identifier. | concurrent editing | `deleteExpense$` + `deleteSheetRow` |
| 23 | **Queued `addExpense` writes can be duplicated (at-least-once delivery).** If Google applies a replayed `insertDimension`/`updateCells` batch but the HTTP response is lost (a dropped connection, a reload mid-request), the outbox has no way to tell "applied, response lost" apart from "not applied", so the record is retried and produces a second row. There is no id column or dedupe key (`docs/backend-less-assessment.md` P0 #1 is out of scope for the outbox slice). Needs a stable per-row identifier to fix for real. | a connection drop between the batch landing and its response arriving | `OutboxEffects`'s drain pass |
| 24 | **A drain pass's ordering can be "order sent", not "order entered".** A `failed` record that gets Retried lands above expenses sent while it was failing; a second tab whose stale `pendingCountSelector` reads 0 can send a new expense live ahead of items another tab already queued. Both are consequences of accepting item 23 rather than adding row-order tracking. | Retry after other sends, or a stale second tab | `OutboxEffects` (D5/D8 of `docs/specs/write-outbox.md`) |

# Fragility and debt

| # | Issue | Note |
|---|---|---|
| 11 | **The gviz endpoint is a charting API used as a query API.** Not versioned relative to Sheets, so its response envelope is not a contract Google guarantees stable for this use. | [gviz](../interfaces/gviz-query.md) |
| 13 | **`AppComponent`'s test suite is `describe.skip`.** Needs `AbstractSecurityService`, `NetworkStatusService`, `SpreadsheetService`, and `SwUpdate` mocked in its `TestBed` (none are currently provided), and its "should render title" test asserts `.content span` contains scaffold boilerplate text absent from the current `app.component.html`. The mocks and the replacement title assertion are judgment calls, not a one-line fix. | [testing](../operations/testing.md) |
| 25 | **The outbox is not cleared on logout or a user change.** `AbstractSecurityService.logout()` only clears `LocalStorageService`; IndexedDB's `exp-spsh-outbox` is untouched. On a shared device, the next signed-in user can see a previous user's queued-expense summary in the failure notice (surfaced only as a spreadsheet-mismatch Retry/Discard prompt, never the raw data) and can Retry or Discard it. Deliberately out of scope — fixing it means touching `AbstractSecurityService.logout` (`src/services/security/abstract-security.service.ts:41-50`), which the write-outbox spec explicitly excludes. Delete the database by hand (DevTools → Application → IndexedDB → delete `exp-spsh-outbox`) to reset it. | logging out or switching Google accounts with a non-empty outbox | `AbstractSecurityService.logout`, `OutboxEffects` |
| 26 | **A hung `addExpense` request holds the drain pass, and its Web Lock, indefinitely.** No `HttpClient` call in this codebase has a request timeout, and the outbox's replay path is no exception. A request that never resolves keeps `OutboxDrainLock`'s lock held until the tab is reloaded; every other tab's drain pass then waits behind it (queued, not lost — records stay in IndexedDB). | a request that never completes (server hang, some proxy/extension interference) | `OutboxEffects`'s drain pass, `OutboxDrainLock` |
| 27 | **A queued expense's date can shift with the device's timezone.** `getSerialNumberFromDate` (`expense-row.ts`) is applied when the write actually goes out, using the timezone offset of that instant on the device draining it — not the timezone in effect when the expense was entered. A live add makes the same computation at submit time, so this is only a new exposure for anything that spends time queued (e.g. across a flight) before sending. | the device's timezone changes between queueing and a successful drain | `OutboxEffects`'s drain pass, `expense-row.ts`'s `getSerialNumberFromDate` |