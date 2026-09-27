---
type: Constraint
title: Known issues and rough edges
description: Remaining defects and fragilities identified by reading the code, each with its trigger and the file to look at. Only currently-open issues are listed; item numbers are intentionally non-sequential because other docs cite specific items by number.
tags: [constraints, known-issues, defects, technical-debt]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
sources:
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: AppEffects
  - id: expenses
    resource: ../../src/modules/dashboard/expenses.service.ts
    title: ExpensesService
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.ts
    title: DashboardPageContainer
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService
  - id: outboxeffects
    resource: ../../src/services/outbox/outbox.service.ts
    title: OutboxService
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
| 2 | **Delete only sees the newest 100 rows.** Older expenses are not found; the delete rolls back with a toast. Needs a stable row id. | deleting an older expense | `ExpensesService.delete` |
| 3 | **Row deletion is positional.** The index from a fresh read is the sheet row index; a concurrent edit or sort removes the wrong row. | editing the sheet during a delete | `ExpensesService.delete`, `deleteSheetRow` |
| 23 | **Queued writes can duplicate.** If Google applied a replayed batch but the response was lost, the record is retried and a second row appears. No dedupe key. | connection drop after the batch lands | `OutboxService` drain pass |
| 24 | **Outbox order can be "order sent", not "order entered".** A retried failed record lands above later sends. | Retry after other sends | `OutboxService` |
| 33 | **A voice-recognition failure toasts the raw error.** `DashboardPageContainer` dispatches `operationFailed({ source: 'Gemini', message: error })` with the error object itself, bypassing `FAILURE_MESSAGES`. | Gemini error, or a note with no valid expense | `DashboardPageContainer.logRecognizedExpenses` |

# Fragility and debt

| # | Issue | Note |
|---|---|---|
| 11 | **gviz is a charting API used as a query API.** Its envelope is not a versioned contract. | [gviz](../interfaces/gviz-query.md) |
| 13 | **`app.component.spec.ts` is `describe.skip`.** It would need `AbstractSecurityService`, `NetworkStatusService`, `SpreadsheetService`, and `SwUpdate` mocks, and it asserts scaffold text absent from the template. | [testing](../operations/testing.md) |
| 25 | **The outbox survives logout and user changes.** `logout()` clears only localStorage. On a shared device the next user sees the previous user's failure notice (as a spreadsheet mismatch) and can Retry or Discard it. Reset by deleting IndexedDB `exp-spsh-outbox`. | `AbstractSecurityService.logout`, `OutboxService` |
| 26 | **A hung request holds the drain pass** until reload; later triggers only coalesce behind it. No `HttpClient` call has a timeout. | `OutboxService` |
| 27 | **A queued expense's date can shift with the device timezone.** The serial number is computed at send time with that moment's offset. | `OutboxService`, `expense-row.ts` |
| 28 | **The four localStorage persist effects fail silently and permanently.** `saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$`, `saveCategories$` catch on the outer pipe: a throwing `setItem` (quota, private mode) is only logged, and that effect completes for the rest of the session, so later values are never persisted. | `AppEffects` |
| 31 | **The deploy job is not guarded to `master` pushes.** `pull_request` runs reach `deploy` too. | `.github/workflows/webpack.yml` |
| 32 | **`GGG_KEY` (the Gemini key) is missing from CI and `keys.example.json`.** `ExpenseRecognitionService` reads `keys.GGG_KEY`; the workflow writes only `CLIENT_ID`, `API_KEY`, `CLIENT_SECRET`, `APP_ID`, so the CI type-check fails, and a fresh clone copying the template does not build. | `.github/workflows/webpack.yml`, `keys.example.json` |
