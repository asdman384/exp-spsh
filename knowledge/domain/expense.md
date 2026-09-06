---
type: Domain Entity
title: Expense
description: A single spending record - date, amount, category, optional comment, and an "in debt" marker - stored as one spreadsheet row.
tags: [domain, expense, model]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: model
    resource: ../../src/shared/models/expense.ts
    title: Expense interface
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService read/write mapping
  - id: helpers
    resource: ../../src/shared/helpers/index.ts
    title: isExpenseEqual
---

# Schema

```ts
interface Expense {
  date?: Date;
  amount?: number;
  category?: string;   // references Category.name, not an id
  comment?: string;
  isInDebt?: boolean;
}
```

**Every field is optional.** This is deliberate: the same type is reused for aggregate rows
produced by [statistics](/flows/statistics.md), where only `category` + `amount` are set, or
only `amount` + `comment` + `date`. The [expenses table](/interfaces/expenses-table-component.md)
decides which columns to render by testing which fields have data.

# Row mapping

An expense is one row of a `data_<user>` sheet, five columns wide.[^svc] See
[spreadsheet layout](/domain/spreadsheet-layout.md) for the authoritative column table.

| Field | Column | Stored as |
|---|---|---|
| `category` | A | string, validated against the `categories` sheet range |
| `comment` | B | string |
| `amount` | C | number, must be >= 0 |
| `date` | D | **Sheets serial number** (days since 1899-12-30) |
| `isInDebt` | E | the *amount* when true, empty when false |

Column E is the subtle one: the app writes `expense.amount` into E when `isInDebt` is set
and `undefined` otherwise, then reads it back as a **presence test**
(`isInDebt !== undefined && isInDebt !== null`). The boolean in the model is therefore a
projection of "is column E non-empty", and the numeric value is only meaningful inside the
spreadsheet, where it lets the owner sum outstanding debt with a formula.

# Identity

Expenses have **no id**. Two expenses are considered the same row when every field matches,
compared by `isExpenseEqual`:[^helpers] `comment`, `category`, `amount`, the coerced
booleans `!!isInDebt`, and the date compared field-by-field down to seconds
(year, month, date, hours, minutes, seconds — deliberately *not* `getTime()`, so that two
`Date` objects differing only in milliseconds still match).

This identity function is what [delete expense](/flows/delete-expense.md) uses to locate the
row to remove, and it is the most heavily unit-tested piece of the codebase (13 cases in
`src/shared/helpers/index.spec.ts`).

# Ordering

New expenses are inserted at **row 0** of the sheet, so a data sheet is ordered
newest-first. Code that computes a row index from a fetched array (delete) depends on that
ordering matching what the server returns.

[^svc]: SpreadsheetService read/write mapping
[^helpers]: isExpenseEqual
