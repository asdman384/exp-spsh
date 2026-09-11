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
---

Everything below was derived by reading the code in this repository and has **not been
reproduced at runtime**. Treat each as a lead, not a verdict.

# Correctness

| # | Issue | Trigger | Where |
|---|---|---|---|
| 2 | **Delete only sees the newest 100 rows.** `loadLastExpenses(title, 100)` caps what the effect can search: an expense older than the 100 most recent can't be located, so `deleteExpense$` throws `cannot find expense in the last 100 rows`, which triggers the rollback path (the optimistic removal is reverted and a toast reports the failure) — the delete visibly fails rather than silently succeeding. Needs a real lookup (by row content or a stable id) to actually support deleting older rows. | deleting an expense older than the 100 most recent | `app.effects.ts`, `deleteExpense$` |
| 3 | **Row deletion is positional.** The array index from a fresh read is used as the sheet row index. A concurrent edit or a manual sort in Google Sheets between read and delete removes the wrong row. Same root cause as item 2; a real fix needs a stable row identifier. | concurrent editing | `deleteExpense$` + `deleteSheetRow` |

# Fragility and debt

| # | Issue | Note |
|---|---|---|
| 11 | **The gviz endpoint is a charting API used as a query API.** Not versioned relative to Sheets, so its response envelope is not a contract Google guarantees stable for this use. | [gviz](../interfaces/gviz-query.md) |
| 13 | **`AppComponent`'s test suite is `describe.skip`.** Needs `AbstractSecurityService`, `NetworkStatusService`, `SpreadsheetService`, and `SwUpdate` mocked in its `TestBed` (none are currently provided), and its "should render title" test asserts `.content span` contains scaffold boilerplate text absent from the current `app.component.html`. The mocks and the replacement title assertion are judgment calls, not a one-line fix. | [testing](../operations/testing.md) |