---
type: Flow
title: Load expenses
description: The single read path for the expense table - who triggers it, the date window rules, and the online gate.
tags: [flow, expense, read, gviz, offline]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: expenses
    resource: ../../src/modules/dashboard/expenses.service.ts
    title: ExpensesService.load
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.view-model.ts
    title: DashboardPageViewModel.expenses
  - id: stats
    resource: ../../src/modules/dashboard/statistics/statistics.container.ts
    title: StatisticsContainer.formChanged
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService.loadExpenses
---

# Callers

`ExpensesService.load({ sheetId, from?, to? })` fills the saved-expense list.
The list is the service's `expenses` signal; it is not in the NgRx store.[^expenses]

| Caller | Window |
|---|---|
| `DashboardPageViewModel` constructor (if a current sheet exists) | month start through today, inclusive |
| dashboard date change | month start through the selected day, inclusive |
| automatic date moves to a new day on resume or submit | month start through today, inclusive |
| dashboard person change | month start through the selected day, inclusive |
| `OutboxService.sent$` (only on `/dashboard`) | month start through the last sent record's date |
| `StatisticsContainer.formChanged` | the selected month |

`load` uses `to` as the selected date, and defaults to today when `to` is absent.
A lone `from` does not set the selected date.
It requests `[month start, selected day + 1 day)` using local midnight boundaries.
Both `from` and `to` must be supplied to preserve a custom range; statistics sends
`[1st of month, 1st of next month)`.[^expenses][^stats]

The dashboard combines saved expenses with pending and failed outbox records for the selected
spreadsheet and numeric person ID. No spreadsheet or person means no queued rows. Queued rows
come first in reverse outbox order; saved order stays the same. Its computed daily list
filters these combined rows to the selected local calendar day. It includes all times on that day and excludes entries without a date.[^page]

The summary below the form uses that daily list for its daily total. Month and Debt totals
filter the combined rows from local month start through the selected day. Debt is a signed
subtotal and also contributes to regular totals. Invalid dates are excluded and missing or
non-finite amounts contribute zero. Daily/month totals have two decimals; Debt has up to two.
Formatting uses a decimal point without grouping or currency, and normalizes rounded negative
zero. An overflowing sum displays `Unavailable`. The day label is `Today` for today and `Daily`
otherwise; the month label is the full English month name. Without a selected person, the
summary displays `Select a person to view totals`.[^page]

The summary uses the current loaded rows without request identity or load-status tracking.
An empty list displays zero. Existing service retention, outbox refresh, and deletion behavior
also apply to totals. No additional request or expense store is used.

# The pipeline

```
load(filter) --switchMap--> online$.filter(true) --exhaustMap--> loading(true); svc.loadExpenses
             --> expenses.set(rows); loading(false)
```

An offline call waits and fires when connectivity returns; a newer call replaces the
waiting one.[^expenses] The inner `online$` stream never completes, so **the latest
`load` re-runs on every later offline → online transition**. The signal is replaced
wholesale. `ExpensesService` is a root singleton, so the list survives navigation between
the dashboard and statistics pages.

On failure, `reportFailure('loadExpenses$')` shows "Couldn't load your expenses. Check your
connection and try again." and the table keeps its previous rows.

# The request

A gviz query, not the Sheets REST API ([gviz](../interfaces/gviz-query.md)):[^svc]

```
GET https://docs.google.com/a/google.com/spreadsheets/d/<spreadsheetId>/gviz/tq
    ?gid=<sheetId>&tq=select A, B, C, D, E where D >= date '2026-9-5' [and D < date '2026-9-6']
```

The JSONP-style text is unwrapped with `/setResponse\(({.*})\)/`; rows are parsed by
`fromExpenseGvizRow` ([row mapping](../domain/expense.md#row-mapping)). Empty category or
amount cells become `''`/`0`; a date string that is not `Date(…)` throws and fails the load.

# Caveats

- Date literals have no zero padding (`2026-9-5`); gviz accepts it.
- No paging: a whole month is fetched at once.
- `loadLastExpenses` (`values.get` on `A1:E<n>`) is a separate read used only by
  [delete](delete-expense.md).

[^page]: DashboardPageViewModel.expenses
[^stats]: StatisticsContainer.formChanged
[^expenses]: ExpensesService.load
[^svc]: SpreadsheetService.loadExpenses
