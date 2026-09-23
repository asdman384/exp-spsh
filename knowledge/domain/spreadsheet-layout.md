---
type: Data Contract
title: Spreadsheet layout and date encoding
description: The exact tab structure, column positions, data validations, and the serial-number date encoding that the app depends on.
tags: [domain, spreadsheet, schema, dates]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService formats
  - id: row
    resource: ../../src/services/spreadsheet/expense-row.ts
    title: Column order and date conversion
  - id: setup
    resource: ../../src/modules/setup/setup-page/setup-page.container.ts
    title: Sheet creation during setup
  - id: serialdoc
    resource: https://developers.google.com/sheets/api/reference/rest/v4/DateTimeRenderOption
    title: Sheets DateTimeRenderOption (SERIAL_NUMBER)
    author: team:google-sheets-docs
---

# Tabs

| Tab | Columns | Created by | Purpose |
|---|---|---|---|
| `categories` | 2 | setup (`addSheet(title, 2)`) | one [category](category.md) per row |
| `data_<name>` | 5 | setup (`addSheet(title, EXPENSE_COLUMN_COUNT)`) | one [expense](expense.md) per row, per person |
| anything else | — | the user | ignored; setup picks up only non-hidden tabs whose title contains `data_` |

New tabs start with `gridProperties: { rowCount: 1, columnCount }`. There is no header row;
row 0 is data.

# `data_<name>`

| Col | Field | Validation (set by `setDataSheetFormats`, rows 0–1048576) |
|---|---|---|
| A | `category` | `ONE_OF_RANGE` `=categories!$A:$A`, strict |
| B | `comment` | none |
| C | `amount` | `NUMBER_GREATER_THAN_EQ 0`, strict |
| D | `date` | `DATE_IS_VALID`, strict; format `d/mm/yyyy HH:mm`; column width 120 px |
| E | `isInDebt` | `NUMBER_GREATER_THAN_EQ 0`, strict — the amount when in debt, empty otherwise |

Column positions come from `EXPENSE_COLUMNS` in `expense-row.ts`.[^row]

# `categories`

| Col | Field | Validation |
|---|---|---|
| A | `name` | none |
| B | `id` (position) | `NUMBER_GREATER_THAN_EQ 0`, strict |

# Date encoding

## Serial numbers (writes, and `values.get` reads)

Whole part = days since 1899-12-30, fraction = time of day.[^serialdoc] `25569` is the offset
between that epoch and the Unix epoch.

```ts
// Date -> serial (write)
25569 + (date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000

// serial -> Date (read)
utc = (serial + 1e-10 - 25569) * 86_400_000
new Date(utc + new Date(utc).getTimezoneOffset() * 60_000)
```

Both directions apply the local timezone offset, so the sheet stores wall-clock time. The
read uses the offset at the stored instant, so DST boundaries round-trip. The `1e-10` guards
against floating-point truncation. Reading from a different timezone still shows the stored
wall-clock time unchanged.

## `Date(y,m,d,h,mi,s)` strings (gviz reads)

gviz returns dates like `Date(2024,0,16,12,14,23)` (zero-based month). `secureParseDate`
parses them with an anchored regex and throws `should provide a valid date` otherwise; it
never `eval`s. See [gviz](../interfaces/gviz-query.md).

# What depends on the layout

- **Column order.** Reads and writes assume A–E as above. Reordering columns in Google Sheets
  misaligns every read and write; changing the order in code is a one-line edit to
  `EXPENSE_COLUMNS` but breaks existing spreadsheets.
- **Row position** is the only handle for deletion (`deleteDimension` by index); a manual sort
  between a read and a delete can remove the wrong row.

[^row]: Column order and date conversion
[^serialdoc]: Sheets DateTimeRenderOption (SERIAL_NUMBER)
