---
type: Data Contract
title: Spreadsheet layout and date encoding
description: The exact tab structure, column positions, data validations, and the serial-number date encoding that the app depends on.
tags: [domain, spreadsheet, schema, dates]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService formats and mapping
  - id: setup
    resource: ../../src/modules/setup/setup-page/setup-page.container.ts
    title: Sheet creation during setup
  - id: serialdoc
    resource: https://developers.google.com/sheets/api/reference/rest/v4/DateTimeRenderOption
    title: Sheets DateTimeRenderOption (SERIAL_NUMBER)
    author: team:google-sheets-docs
---

# Tabs

One spreadsheet, owned by the user, holds every tab:

| Tab | Columns | Created by | Purpose |
|---|---|---|---|
| `categories` | 2 | setup (`addSheet(title, 2)`) | one [category](category.md) per row |
| `data_<name>` | 5 | setup (`addSheet(title, 5)`) | one [expense](expense.md) per row, per person |
| anything else | — | the user | ignored; setup only picks up non-hidden tabs containing `data_` |

New tabs are created with `gridProperties: { rowCount: 1, columnCount }` — a single row —
and grow as rows are inserted.

# Schema: `data_<name>`

| Col | Field | Type | Validation applied at setup |
|---|---|---|---|
| A | `category` | string | `ONE_OF_RANGE` against `=categories!$A:$A`, strict |
| B | `comment` | string | none |
| C | `amount` | number | `NUMBER_GREATER_THAN_EQ 0`, strict |
| D | `date` | date-time | `DATE_IS_VALID`, strict; number format `d/mm/yyyy HH:mm`; column width 120px |
| E | `isInDebt` | number | `NUMBER_GREATER_THAN_EQ 0`, strict — holds the amount when in debt, empty otherwise |

Validations are applied over rows `0..1048576` (the full sheet) by `setDataSheetFormats`.

# Schema: `categories`

| Col | Field | Type | Validation |
|---|---|---|---|
| A | `name` | string | none |
| B | `id` (position) | number | `NUMBER_GREATER_THAN_EQ 0`, strict |

# Date encoding

Dates cross the boundary in **two different encodings**, depending on which API is used.

## Serial numbers (`values.*` and `updateCells`)

The Sheets API's `SERIAL_NUMBER` form: whole part = days since **1899-12-30**, fractional
part = fraction of the day.[^serialdoc] Conversion happens in two private helpers:

```ts
// local Date -> serial
25569.0 + (date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000

// serial -> local Date
new Date((serial + 1e-10 - 25569.0) * 86_400_000 + new Date().getTimezoneOffset() * 60_000)
```

`25569` is the offset between the Unix epoch and 1899-12-30. Both directions apply the
**local** timezone offset, so the spreadsheet stores wall-clock time as the user saw it, not
UTC. The `1e-10` nudge in the reverse direction guards against floating-point truncation of
whole-minute values.

> Consequence: reading the same sheet from a different timezone shifts displayed times.
> The reverse conversion also uses `new Date().getTimezoneOffset()` (today's offset), not
> the offset in effect on the stored date, so DST boundaries shift historical rows by an
> hour.

## `Date(y,m,d,h,mi,s)` strings (gviz query)

The Visualization Query endpoint returns dates as literal strings such as
`Date(2024,0,16,12,14,23)` with a **zero-based month**. `secureParseDate` parses them with
the anchored regex
`/^Date\((\d{4}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2})\)$/` and throws
`should provide a valid date` on anything else — deliberately refusing to `eval` the value.
See [the gviz interface](../interfaces/gviz-query.md).

# Why the layout is load-bearing

- Column **order** is hard-coded in `addExpense`, `loadLastExpenses` (`A1:E<n>`), and the
  gviz `select A, B, C, D, E`. Inserting a column in the spreadsheet breaks reads and writes.
- Row **position** is the only handle for deletion (`deleteDimension` by index), so a manual
  sort in Google Sheets between a read and a delete can remove the wrong row.
- The app never writes a header row; row 0 is data.

[^serialdoc]: Sheets DateTimeRenderOption (SERIAL_NUMBER)
