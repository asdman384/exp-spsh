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
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.ts
    title: DashboardPageContainer.getInterval
  - id: stats
    resource: ../../src/modules/dashboard/statistics/statistics.container.ts
    title: StatisticsContainer.formChanged
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService.loadExpenses
---

# Callers

`ExpensesService.load({ sheetId, from?, to? })` is the only way expenses enter the list.
The list is the service's `expenses` signal; it is not in the NgRx store.[^expenses]

| Caller | Window |
|---|---|
| `DashboardPageContainer` constructor (if a current sheet exists) | none — `from` defaults to today, open-ended |
| dashboard date change | `getInterval(date)` |
| dashboard person change | `getInterval(current date)` |
| `OutboxService.sent$` (only on `/dashboard`) | the last sent record's day |
| `StatisticsContainer.formChanged` | the selected month |

`getInterval(from)`: if `from` is today, send only `from` (open-ended); otherwise
`{ from, to: from + 1 day }`.[^page] Statistics sends `[1st of month, 1st of next month)`.[^stats]

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

[^page]: DashboardPageContainer.getInterval
[^stats]: StatisticsContainer.formChanged
[^expenses]: ExpensesService.load
[^svc]: SpreadsheetService.loadExpenses
