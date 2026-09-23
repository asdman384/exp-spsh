---
type: Flow
title: Load expenses
description: The single read path for the expense table - who triggers it, the date window rules, and the online gate.
tags: [flow, expense, read, gviz, offline]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: loadExpenses$
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.ts
    title: DashboardPageContainer.getInterval
  - id: stats
    resource: ../../src/modules/dashboard/statistics/statistics.container.ts
    title: StatisticsContainer.formChanged
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService.loadExpenses
  - id: outbox
    resource: ../../src/@state/outbox.effects.ts
    title: reloadOnDrainCompleted$
---

# Callers

`loadExpenses({ sheetId, from?, to? })` is the only way expenses enter the store.

| Caller | Window |
|---|---|
| `DashboardPageContainer` constructor (if a current sheet exists) | none — `from` defaults to today, open-ended |
| dashboard date change | `getInterval(date)` |
| dashboard person change | `getInterval(current date)` |
| `addExpense$` after a live write | the expense's day |
| `OutboxEffects.reloadOnDrainCompleted$` (only on `/dashboard`) | the last sent record's day |
| `StatisticsContainer.formChanged` | the selected month |

`getInterval(from)`: if `from` is today, send only `from` (open-ended); otherwise
`{ from, to: from + 1 day }`.[^page] Statistics sends `[1st of month, 1st of next month)`.[^stats]

# The effect

```
loadExpenses --switchMap--> online$.filter(true) --exhaustMap--> loading(true); svc.loadExpenses
             --> storeExpenses; loading(false)
```

An offline dispatch waits and fires when connectivity returns; a newer dispatch replaces the
waiting one.[^effects] The inner `online$` stream never completes, so **the latest
`loadExpenses` re-runs on every later offline → online transition**. `storeExpenses` replaces
the array wholesale.

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
[^effects]: loadExpenses$
[^svc]: SpreadsheetService.loadExpenses
