---
type: API Client
title: Google Sheets v4 REST interface
description: Every Sheets API call the app makes, with endpoint, parameters, and the SpreadsheetService method that wraps it.
tags: [interface, google-sheets, api, http]
resource: https://developers.google.com/sheets/api/reference/rest
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService
  - id: row
    resource: ../../src/services/spreadsheet/expense-row.ts
    title: Expense row mapping
  - id: report
    resource: ../../src/services/spreadsheet/category-spending-report.ts
    title: Category spending report request builder
  - id: spec
    resource: https://developers.google.com/sheets/api/reference/rest
    title: Google Sheets API v4 reference
    author: team:google-sheets-docs
---

# Client shape

`SpreadsheetService` (`providedIn: 'root'`) holds a mutable `spreadsheetId` and builds URLs
from `https://content-sheets.googleapis.com/v4/spreadsheets/<spreadsheetId>`.[^svc]

- The `gapi` client library is never loaded; only its types are used.
- Every call adds `key: keys.API_KEY`, and [`ExpAuthInterceptor`](http-auth-interceptor.md)
  adds a `Bearer` token.
- `setSpreadsheetId` must run before calls that use the active file. File creation and calls with an explicit file ID work independently. It runs in
  `AppComponent`'s constructor (from persisted state) and during
  [setup](../flows/initial-setup.md).

# Calls

| Method | HTTP | Endpoint | Notable params |
|---|---|---|---|
| `createSpreadsheet()` | POST | `https://sheets.googleapis.com/v4/spreadsheets` | `{ properties: { title: 'Expenses' } }`; returns a typed Spreadsheet with `spreadsheetId`; no automatic retry |
| `getSpreadsheet(id)` | GET | `/v4/spreadsheets/{id}` | `includeGridData: false` |
| `syncCategorySpendingReport(id, createIfMissing)` | GET, then POST if needed | `/v4/spreadsheets/{id}` and `/v4/spreadsheets/{id}:batchUpdate` | Uses fresh metadata and the same explicit ID for each attempt. |
| `getAllCategories()` | GET | `/values/categories!A:B` | `valueRenderOption: UNFORMATTED_VALUE` |
| `addCategory({name,id})` | POST | `/values/categories!A1:B1:append` | `insertDataOption: INSERT_ROWS`, `valueInputOption: RAW` |
| `updateCategories(list)` | PUT | `/values/categories!A1:B{n}` | `valueInputOption: RAW`; rewrites the range |
| `loadLastExpenses(title, take = 1)` | GET | `/values/{title}!A1:E{take}` | `valueRenderOption: UNFORMATTED_VALUE` |
| `addSheet(title, columnCount)` | POST | `:batchUpdate` | `addSheet`, `gridProperties { rowCount: 1, columnCount }` |
| `addExpense(sheetId, expense)` | POST | `:batchUpdate` | `insertDimension` row 0 + `updateCells` |
| `deleteSheetRow(sheetId, index)` | POST | `:batchUpdate` | `deleteDimension` ROWS `[index, index+1)` |
| `setDataSheetFormats(sheetId)` | POST | `:batchUpdate` | 4 × `repeatCell` validation + date column width |
| `setCategoriesSheetFormats(sheetId)` | POST | `:batchUpdate` | 1 × `repeatCell` validation on column B |

Ranges are `encodeURIComponent`-escaped. Expense column positions and cell encoding come from
`expense-row.ts` ([row mapping](../domain/expense.md#row-mapping)).[^row] The expense-table
read (`loadExpenses`) uses [gviz](gviz-query.md), not this API. Validation details are in
[spreadsheet layout](../domain/spreadsheet-layout.md).

# Report creation and refresh

Discovery uses sheet properties and sheet-level developer metadata.
A sheet-level `DOCUMENT` tag with key `exp_spsh.report` and value `category_spending_v1`
identifies the report. Setup uses column D on that sheet for the user list.
An occupied report title, ambiguous ownership or an invalid report grid returns
a conflict without a write. Inspection returns `absent` for an available report title.[^report]

An explicit Add selects an unused positive tab ID and sends one atomic batch. It adds the
grid, tag, selectors, formulas, formats and roster, hides the helper columns,
and adds one line chart. To retain the point style and left-axis title on the initially
empty chart, the batch supplies a numeric amount during chart creation and restores its
formula before commit. A refresh uses `updateCells.range` on column D
with the field mask `userEnteredValue`. This clears old names below the current list.
When the grid needs more rows, the same batch appends them with `appendDimension`. A lost
response propagates to Setup. Retry repeats discovery and refreshes a report that Google
already created.[^svc][^report]

# Error handling

The service returns raw `Observable`s and inspects no status codes. Callers decide: effects
toast via `reportFailure`, the outbox classifies with `classifyWriteError`
([write outbox](../architecture/write-outbox.md#classifywriteerror)), and setup displays stage-specific errors with retained-file recovery.

[^svc]: SpreadsheetService
[^row]: Expense row mapping
[^report]: Category spending report request builder
