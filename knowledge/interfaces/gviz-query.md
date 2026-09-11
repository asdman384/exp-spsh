---
type: API Client
title: Google Visualization Query (gviz/tq) interface
description: The undocumented-for-this-purpose query endpoint the app uses for all filtered expense reads, its query string, response shape, and parsing rules.
tags: [interface, gviz, query, read-path]
resource: https://developers.google.com/chart/interactive/docs/querylanguage
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService.loadExpenses and ExpensesDTO
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

The Sheets `values.get` API can only return a *range*. Filtering expenses by date range
would mean fetching the whole tab and filtering client-side. The Visualization Query
endpoint accepts a SQL-like `tq` parameter and does the filtering server-side, which is why
the app's main read path bypasses the Sheets REST API entirely.[^qlang]

# Request

```
GET https://docs.google.com/a/google.com/spreadsheets/d/<spreadsheetId>/gviz/tq
    ?gid=<Sheet.id>
    &tq=<query>
Authorization: Bearer <access_token>     (added by ExpAuthInterceptor)
responseType: text
```

The query is built by string concatenation:[^svc]

```sql
select A, B, C, D, E
where D >= date '2026-9-5'
  [and D < date '2026-9-6']
```

- Column letters are positional — this is the third place the
  [column layout](../domain/spreadsheet-layout.md) is hard-coded.
- Date literals use `getFullYear()`-`getMonth()+1`-`getDate()` with **no zero padding**.
- `from` defaults to `new Date()` (today) when omitted; the `and D < ...` clause is added
  only when `to` is provided.
- The values are interpolated unescaped, but they come from `Date` getters (numbers), so
  there is no injection surface from user input here.
- The `/a/google.com/` path segment is a legacy hosted-domain form that still resolves.

# Response

The endpoint replies with JavaScript, not JSON:

```
/*O_o*/
google.visualization.Query.setResponse({"version":"0.6", ..., "table":{...}});
```

The service requests it as `text` and extracts the payload with the regex
`/setResponse\(({.*})\)/`, throwing `Invalid response format from Google Sheets API` when it
does not match. That regex is greedy and single-line — it depends on the response being a
single line, which it currently is. **A non-JSON error page (auth failure, wrong `gid`) also
fails this match**, so all such errors surface as the same generic message.

Typed as `ExpensesDTO`:

```ts
{
  table: {
    cols: Array<{ id, label, type: 'string'|'number'|'datetime', pattern?: string }>;
    rows: Array<{ c: Array<{ v: string | number; f?: string }> }>;
  }
}
```

Only `rows` is read; `cols` is declared but unused. Cell access is positional:
`c[0]` category, `c[1]` comment, `c[2]` amount, `c[3]` date, `c[4]` isInDebt. `c[0]` and
`c[2]` are dereferenced without a null guard — an empty cell in those columns throws.

Datetime cells arrive as the string `Date(2024,0,16,12,14,23)` (zero-based month) and go
through `secureParseDate`, which validates with an anchored regex rather than evaluating the
string. See [date encoding](../domain/spreadsheet-layout.md).

# Auth and caching

The endpoint accepts the same OAuth bearer token as the Sheets API.[^oauthdoc] It is listed
in the service worker's `dataGroups` with zero caching
([service worker](../architecture/pwa-and-service-worker.md)).

# Stability risk

This is a charting endpoint being used as a query API. It is not versioned alongside the
Sheets API, so its response envelope is not a contract Google guarantees stable for this
use. Treat a sudden universal read failure as a candidate for an upstream format change
first ([troubleshooting](../operations/troubleshooting.md)).

[^svc]: SpreadsheetService.loadExpenses and ExpensesDTO
[^qlang]: Visualization API query language reference
[^oauthdoc]: Using OAuth to access gviz/tq
