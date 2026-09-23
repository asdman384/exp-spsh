---
type: Domain Entity
title: Expense
description: A single spending record - date, amount, category, optional comment, and an "in debt" marker - stored as one spreadsheet row.
tags: [domain, expense, model]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: model
    resource: ../../src/shared/models/expense.ts
    title: Expense interface
  - id: row
    resource: ../../src/services/spreadsheet/expense-row.ts
    title: Expense row mapping (EXPENSE_COLUMNS, cell writers, row parsers)
  - id: helpers
    resource: ../../src/shared/helpers/index.ts
    title: isExpenseEqual
---

# Schema

```ts
interface Expense {
  date?: Date;
  amount?: number;
  category?: string;   // Category.name, not an id
  comment?: string;
  isInDebt?: boolean;
}
```

Every field is optional because [statistics](../flows/statistics.md) reuses the type for
aggregate rows (`category` + `amount`, or `amount` + `comment` + `date`). The
[expenses table](../interfaces/expenses-table-component.md) renders only the columns that
have data.

# Row mapping

One expense is one five-column row of a `data_<user>` sheet. All mapping lives in
`src/services/spreadsheet/expense-row.ts`, driven by one ordered list,
`EXPENSE_COLUMNS = ['category', 'comment', 'amount', 'date', 'isInDebt']`; column letters,
indexes, the `A1:E<n>` range, and the gviz `select` list are derived from it.[^row]

| Field | Column | Written as |
|---|---|---|
| `category` | A | string |
| `comment` | B | string |
| `amount` | C | number |
| `date` | D | Sheets serial number ([date encoding](spreadsheet-layout.md#date-encoding)) |
| `isInDebt` | E | the `amount` when true; no value when false |

Column E is read back as a **presence test** (non-null, non-undefined → `true`). The number
is only meaningful inside the spreadsheet, where it lets the owner sum outstanding debt.

Two parsers exist, one per read path, with different leniency:

| Parser | Used by | Missing cells |
|---|---|---|
| `fromExpenseGvizRow` | `loadExpenses` (gviz) | category → `''`, amount → `0`, date → `undefined`; a malformed date string throws |
| `fromExpenseValueRow` | `loadLastExpenses` (`values.get`) | raw pass-through; the date is decoded unguarded |

# Identity

Expenses have **no id**. `isExpenseEqual` treats two expenses as the same row when `comment`,
`category`, `amount`, `!!isInDebt`, and the date's year, month, day, hours, minutes, and
seconds all match (milliseconds are ignored).[^helpers] [Delete](../flows/delete-expense.md)
uses it to locate the row.

# Ordering

New expenses are inserted at row 0, so data sheets are newest-first. Delete depends on that.

[^row]: Expense row mapping
[^helpers]: isExpenseEqual
