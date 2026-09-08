---
type: API Client
title: Google Sheets v4 REST interface
description: Every Sheets API call the app makes, with endpoint, parameters, and the SpreadsheetService method that wraps it.
tags: [interface, google-sheets, api, http]
resource: https://developers.google.com/sheets/api/reference/rest
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService
  - id: spec
    resource: https://developers.google.com/sheets/api/reference/rest
    title: Google Sheets API v4 reference
    author: team:google-sheets-docs
---

# Client shape

`SpreadsheetService` is `providedIn: 'root'`, holds a mutable `spreadsheetId` field set via
`setSpreadsheetId()`, and builds every URL from
`https://content-sheets.googleapis.com/v4/spreadsheets/<spreadsheetId>`.[^svc]

Two things are unusual and worth knowing:

- **The `gapi` client library is never loaded.** Only its `@types` are used, for request and
  response typing. All traffic goes through Angular's `HttpClient`.
- **Every call carries `key: keys.API_KEY`** *and* a `Bearer` token added by
  [`ExpAuthInterceptor`](http-auth-interceptor.md). The API key is imported at
  build time from `keys.json` ([configuration](../operations/configuration-and-secrets.md)).
- `setSpreadsheetId` must be called before any method except `getSpreadsheet`. It happens in
  two places: `AppComponent`'s constructor (from persisted state) and during
  [setup](../flows/initial-setup.md).

# Calls

| Method | HTTP | Endpoint | Notable params |
|---|---|---|---|
| `getSpreadsheet(id)` | GET | `/v4/spreadsheets/{id}` | `includeGridData: false` — the only call that takes an explicit id |
| `getAllCategories()` | GET | `/values/categories!A:B` | `valueRenderOption: UNFORMATTED_VALUE` |
| `addCategory({name,id})` | POST | `/values/categories!A1:B1:append` | `insertDataOption: INSERT_ROWS`, `valueInputOption: RAW` |
| `updateCategories(list)` | PUT | `/values/categories!A1:B{n}` | `valueInputOption: RAW` — rewrites the whole range |
| `loadLastExpenses(title, take)` | GET | `/values/{title}!A1:E{take}` | `valueRenderOption: UNFORMATTED_VALUE`; default `take = 1` |
| `addSheet(title, columnCount)` | POST | `:batchUpdate` | `addSheet` with `gridProperties {rowCount:1, columnCount}` |
| `addExpense(sheetId, expense)` | POST | `:batchUpdate` | `insertDimension` at row 0 + `updateCells` |
| `deleteSheetRow(sheetId, index)` | POST | `:batchUpdate` | `deleteDimension` ROWS `[index, index+1)` |
| `setDataSheetFormats(sheetId)` | POST | `:batchUpdate` | 4 x `repeatCell` validations + `updateDimensionProperties` |
| `setCategoriesSheetFormats(sheetId)` | POST | `:batchUpdate` | 1 x `repeatCell` validation on column B |
| `append(sheetId, expenses)` | POST | `:batchUpdate` | **`@deprecated`** — `appendCells`, no `isInDebt` column; unused |

All ranges are `encodeURIComponent`-escaped before being interpolated into the path.

Reads for the expense table do **not** appear above — they go through
[the gviz endpoint](gviz-query.md) instead.

# Validation payloads (setup only)

`setDataSheetFormats` applies four `repeatCell` requests across rows `0..1048576`, plus a
120px width on the date column. `setCategoriesSheetFormats` applies one. The exact
conditions are tabulated in [spreadsheet layout](../domain/spreadsheet-layout.md).

# Error handling

None at this layer: the service returns raw `Observable`s and every caller (an effect, or
the setup container) decides. Effects log and swallow; the setup container does not catch at
all. HTTP status codes are never inspected, so a 401 and a 403 are indistinguishable
downstream ([known issues](../constraints/known-issues.md)).

# Test coverage

`spreadsheet.service.spec.ts` has 8 tests using `HttpTestingController`, asserting URLs,
methods, and the serial-number date conversion. It is the best-covered unit in the project
([testing](../operations/testing.md)).

[^svc]: SpreadsheetService
