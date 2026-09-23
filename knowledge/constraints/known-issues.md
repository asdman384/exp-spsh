---
type: Constraint
title: Known issues and rough edges
description: Remaining defects and fragilities identified by reading the code, each with its trigger and the file to look at. Only currently-open issues are listed; item numbers are intentionally non-sequential because other docs cite specific items by number.
tags: [constraints, known-issues, defects, technical-debt]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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
  - id: security
    resource: ../../src/services/security/abstract-security.service.ts
    title: AbstractSecurityService.logout
  - id: wf
    resource: ../../.github/workflows/webpack.yml
    title: CI workflow
---

Derived from reading the code; **none reproduced at runtime**. Treat each as a lead. Numbers
are stable IDs — fixed items are removed, never renumbered.

# Correctness

| # | Issue | Trigger | Where |
|---|---|---|---|
| 2 | **Delete only sees the newest 100 rows.** Older expenses are not found; the delete rolls back with a toast. Needs a stable row id. | deleting an older expense | `deleteExpense$` |
| 3 | **Row deletion is positional.** The index from a fresh read is the sheet row index; a concurrent edit or sort removes the wrong row. | editing the sheet during a delete | `deleteExpense$`, `deleteSheetRow` |
| 23 | **Queued writes can duplicate.** If Google applied a replayed batch but the response was lost, the record is retried and a second row appears. No dedupe key. | connection drop after the batch lands | `OutboxEffects` drain pass |
| 24 | **Outbox order can be "order sent", not "order entered".** A retried failed record lands above later sends; a second tab with a stale pending count can send live ahead of another tab's queue. | Retry after other sends; stale second tab | `OutboxEffects` |

# Fragility and debt

| # | Issue | Note |
|---|---|---|
| 11 | **gviz is a charting API used as a query API.** Its envelope is not a versioned contract. | [gviz](../interfaces/gviz-query.md) |
| 13 | **`app.component.spec.ts` is `describe.skip`.** It would need `AbstractSecurityService`, `NetworkStatusService`, `SpreadsheetService`, and `SwUpdate` mocks, and it asserts scaffold text absent from the template. | [testing](../operations/testing.md) |
| 25 | **The outbox survives logout and user changes.** `logout()` clears only localStorage. On a shared device the next user sees the previous user's failure notice (as a spreadsheet mismatch) and can Retry or Discard it. Reset by deleting IndexedDB `exp-spsh-outbox`. | `AbstractSecurityService.logout`, `OutboxEffects` |
| 26 | **A hung request holds the drain pass and its Web Lock** until reload; other tabs' passes wait. No `HttpClient` call has a timeout. | `OutboxEffects`, `OutboxDrainLock` |
| 27 | **A queued expense's date can shift with the device timezone.** The serial number is computed at send time with that moment's offset. | `OutboxEffects`, `expense-row.ts` |
| 28 | **The four localStorage persist effects fail silently and permanently.** `saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$`, `saveCategories$` catch on the outer pipe: a throwing `setItem` (quota, private mode) is only logged, and that effect completes for the rest of the session, so later values are never persisted. | `AppEffects` |
| 31 | **The deploy job is not guarded to `master` pushes.** `pull_request` runs reach `deploy` too. | `.github/workflows/webpack.yml` |
