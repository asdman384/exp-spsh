---
type: API Client
title: Google Visualization Query (gviz/tq) interface
description: The charting query endpoint the app uses for all filtered expense reads, its query string, response shape, and parsing rules.
tags: [interface, gviz, query, read-path]
resource: https://developers.google.com/chart/interactive/docs/querylanguage
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService.loadExpenses and ExpensesDTO
  - id: row
    resource: ../../src/services/spreadsheet/expense-row.ts
    title: EXPENSE_GVIZ_COLUMNS, fromExpenseGvizRow
  - id: qlang
    resource: https://developers.google.com/chart/interactive/docs/querylanguage
    title: Visualization API query language reference
    author: team:google-charts-docs
  - id: oauthdoc
    resource: https://developers.google.com/chart/interactive/docs/spreadsheets
    title: Using OAuth to access gviz/tq
    author: team:google-charts-docs
---

# Why this endpoint

`values.get` only returns ranges; filtering by date would mean fetching the whole tab. The
Visualization Query endpoint filters server-side with a SQL-like `tq`, so the expense table's
read path uses it instead of the Sheets REST API.[^qlang]

# Request

```
GET https://docs.google.com/a/google.com/spreadsheets/d/<spreadsheetId>/gviz/tq
    ?gid=<Sheet.id>&tq=<query>
Authorization: Bearer <access_token>          (ExpAuthInterceptor)
responseType: text
```

```sql
select A, B, C, D, E
where D >= date '2026-9-5'
  [and D < date '2026-9-6']
```

- The column list (`EXPENSE_GVIZ_COLUMNS`) and the date column letter come from
  `EXPENSE_COLUMNS` in `expense-row.ts`.[^row]
- Dates are `getFullYear()-(getMonth()+1)-getDate()`, unpadded; values come from `Date`
  getters, so no user text reaches the query.
- `from` defaults to today; `and D < …` is added only with `to`.
- No API `key` parameter is sent.[^svc]

# Response

JavaScript, not JSON:

```
/*O_o*/
google.visualization.Query.setResponse({"version":"0.6", ..., "table":{...}});
```

The payload is extracted with the greedy, single-line regex `/setResponse\(({.*})\)/`; no
match throws `Invalid response format from Google Sheets API`. An HTML error page (auth
failure, bad `gid`) fails the same way, so those errors look identical.

Only `table.rows[].c[]` (`{ v, f? }` cells) is read. `fromExpenseGvizRow` maps cells by
`EXPENSE_COLUMN_INDEX`: missing category → `''`, missing amount → `0`, missing date →
`undefined`, `isInDebt` = cell present. Dates arrive as `Date(2024,0,16,12,14,23)`
(zero-based month) and go through `secureParseDate` ([date encoding](../domain/spreadsheet-layout.md#date-encoding)).

# Auth and caching

The endpoint accepts the same bearer token as the Sheets API.[^oauthdoc] `docs.google.com` is
not in the service worker's `dataGroups`, so requests bypass the worker's routing entirely.

# Stability risk

This is a charting endpoint used as a query API; its envelope is not a versioned contract.
A sudden universal read failure should first be checked against an upstream format change
([troubleshooting](../operations/troubleshooting.md)).

[^svc]: SpreadsheetService.loadExpenses and ExpensesDTO
[^row]: EXPENSE_GVIZ_COLUMNS, fromExpenseGvizRow
[^qlang]: Visualization API query language reference
[^oauthdoc]: Using OAuth to access gviz/tq
