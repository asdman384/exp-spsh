---
type: Flow
title: Load expenses
description: The single read path for the expense table - who triggers it, the date window rules, and the online gate.
tags: [flow, expense, read, gviz, offline]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
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
---

# One action, five callers

`loadExpenses({ sheetId, from?, to? })` is the only way expenses enter the store.

| Caller | Window |
|---|---|
| `DashboardPageContainer` constructor | no window at all — defaults to "from today" |
| dashboard date change | `getInterval(date)` |
| dashboard person change | `getInterval(currentDate)` |
| `addExpense$` after a successful write | exactly the expense's day |
| `StatisticsContainer.formChanged` | the whole selected month |

`getInterval(from)` encodes a small rule: **if `from` is today, send only `from`** (open
ended, so expenses entered later today keep appearing); otherwise send
`{ from, to: from + 1 day }` — a single past day.[^page]

Statistics sends `from = new Date(year, monthIndex, 1)` and
`to = new Date(year, monthIndex + 1, 1)`.[^stats]

# The effect

```
loadExpenses --> switchMap(whenOnline) --> exhaustMap(loading=true; svc.loadExpenses)
             --> storeExpenses --> loading=false
```

`whenOnline` is `status.online$.pipe(filter(Boolean), map(() => arg))`, so **an offline
dispatch does not fail — it waits**, and fires as soon as connectivity returns.[^effects]
Combined with `switchMap`, a newer request supersedes a pending offline one.

`storeExpenses` **replaces** the array wholesale; nothing merges windows.

# The request

The read does **not** use the Sheets REST API. It uses the Google Visualization Query
endpoint with a SQL-like query — see [gviz](/interfaces/gviz-query.md) for the full
contract:[^svc]

```
GET https://docs.google.com/a/google.com/spreadsheets/d/<spreadsheetId>/gviz/tq
    ?gid=<sheetId>
    &tq=select A, B, C, D, E where D >= date '2026-9-5' [and D < date '2026-9-6']
```

The response is JSONP-shaped text; the service extracts the JSON with
`/setResponse\(({.*})\)/` and throws `Invalid response format from Google Sheets API` when
it does not match. Rows map to [`Expense`](/domain/expense.md) with
`secureParseDate` handling the `Date(y,m,d,h,mi,s)` values.

# Caveats

- The `tq` date literals are built from local date parts with **no zero padding**
  (`2026-9-5`); the query language accepts this.
- `row.c[0].v` and `row.c[2].v` are dereferenced without a null check, so a data row with an
  **empty category or amount cell** throws inside the `map` and the effect swallows it —
  the table then silently keeps its previous contents.
- There is no paging or row limit; a month with many rows is fetched in full.
- `loadLastExpenses` (`values.get` on `A1:E<n>`) is a *different* read used only by
  [delete](/flows/delete-expense.md).

[^page]: DashboardPageContainer.getInterval
[^stats]: StatisticsContainer.formChanged
[^effects]: loadExpenses$
[^svc]: SpreadsheetService.loadExpenses
