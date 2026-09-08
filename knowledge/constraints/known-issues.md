---
type: Constraint
title: Known issues and rough edges
description: Remaining defects and fragilities identified by reading the code, each with its trigger and the file to look at. Trimmed 2026-09-08 - entries for items fixed that day (1, 4, 5, 6, 7, 8, 9, 10, 12, 16, 18, 20, 21, 22) and items confirmed intentional (14, 15) were removed to keep this file short. Item numbers are preserved (not renumbered) because other docs cite them by number - see `git log` around commit `ab1083e` for the removed entries' full text.
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
| 2 | **Delete only sees the newest 100 rows.** `loadLastExpenses(title, 100)` caps what the effect can search, so an expense older than the 100 most recent can't be located or deleted from the sheet. Needs a real lookup (by row content or a stable id) to fix properly. A related bug — a not-found row silently counting as a successful delete — was fixed 2026-09-08 (it now `throw`s into the effect's existing rollback/error handling); the 100-row cap itself is unchanged. | deleting an expense older than the 100 most recent | `app.effects.ts`, `deleteExpense$` |
| 3 | **Row deletion is positional.** The array index from a fresh read is used as the sheet row index. A concurrent edit or a manual sort in Google Sheets between read and delete removes the wrong row. Same root cause as item 2; a real fix needs a stable row identifier. | concurrent editing | `deleteExpense$` + `deleteSheetRow` |

# Fragility and debt

| # | Issue | Note |
|---|---|---|
| 11 | **The gviz endpoint is a charting API used as a query API.** Unversioned relative to Sheets; its envelope has changed before (commit `cdc85e6`). | [gviz](../interfaces/gviz-query.md) |
| 13 | **`AppComponent`'s test suite is `describe.skip`.** Needs `AbstractSecurityService`, `NetworkStatusService`, `SpreadsheetService`, and `SwUpdate` mocked in its `TestBed` (none are currently provided), and its "should render title" test asserts `.content span` contains scaffold boilerplate text `app.component.html` no longer has. Two sibling skipped suites (`LocalStorageService`, `ExpDialogComponent`) were unskipped and fixed 2026-09-08; this one remains because the mocks and the replacement title assertion are judgment calls, not a one-line fix. | [testing](../operations/testing.md) |