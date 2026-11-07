---
type: Component Contract
title: ExpensesTableComponent
description: The shared table used by both the dashboard and statistics - its inputs, outputs, dynamic column rules, and drag-to-delete gesture.
tags: [interface, component, table, drag-drop]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: comp
    resource: ../../src/shared/components/expenses-table/expenses-table.component.ts
    title: ExpensesTableComponent
  - id: html
    resource: ../../src/shared/components/expenses-table/expenses-table.component.html
    title: Table template
---

`<expenses-table>` is the one shared feature component, used by the dashboard and
statistics. It imports `DatePipe`, `DecimalPipe`, `DragDropModule`, and Material checkbox, icon, table, and
tooltip modules directly.[^comp]

`ExpenseTableRow` extends `Expense` with optional numeric `enqueuedAt`, `share`, and `delta`.
Share and delta render beside the amount only when supplied. They are display metadata,
not spreadsheet fields. Plain expenses and
Statistics aggregate rows remain valid inputs. Column keys come from `Expense`; the metadata
is not a column. Drag data and the delete output retain the original row and its metadata.[^comp]

# Inputs

All are `input()` signals; none is required.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `dataSource` | `ReadonlyArray<ExpenseTableRow>` | `[]` | rows to render |
| `showDateCol` | `boolean` | `true` | `false` hides the date column (dashboard) |
| `draggable` | `boolean` | `false` | enables swipe-to-delete |
| `selectable` | `boolean` | `false` | adds the checkbox column |
| `selected` | `ReadonlyArray<Expense>` | `[]` | rows to pre-select; an `effect()` clears the `SelectionModel` and re-selects on change |

# Outputs

| Output | Payload | Used by |
|---|---|---|
| `deleteRow` | `ExpenseTableRow` | dashboard → [delete flow](../flows/delete-expense.md) |
| `cellClick` | `{ field, cellData, rowData }` | statistics drill-down; wired only on the category cell |
| `selectionChange` | `ReadonlyArray<Expense>` | statistics total |

`selectionChange` is `outputFromObservable()` over `selection.changed`, delayed with
`delay(0)`. The delay is required: selection changes happen during the table's own change
detection, and a synchronous emission into the parent (which renders `total` after the table)
would risk `NG0100`.

# Dynamic columns

`columns` is a `computed()` over `dataSource()`, `selectable()`, and `showDateCol()`:

1. `select` first when `selectable()`;
2. then each of `date`, `category`, `amount`, `comment`, `isInDebt` that has data and is not
   hidden — "has data" means some row's value is not `undefined`, except `isInDebt`, which
   needs some row with `true`.

So aggregate rows (`category` + `amount`) show two columns, the drill-down projection shows
`date`, `amount`, `comment`, and the **Debt** column appears only when a debt row exists.

# Rendering

Amount data cells use `display: inline-flex`, selected through Material's generated
`mat-column-amount` class. The Amount header keeps its table-cell layout.

Amounts and deltas explicitly select the Polish locale in the number pipe: a decimal comma, up to two decimal places,
and a non-breaking space between thousands (for example, `1 026,2`). Shares use up to one
decimal place. Statistics totals use the same format. Date pipes use the global `en-US` locale and English month names.

- `date`: `dd MMM`, tooltip `dd MMM HH:mm` (`DATE_FORMAT` / `DATE_TIME_FORMAT`).
- `comment`: line-clamped, full text in a tooltip.
- `isInDebt`: a `check` icon when true.
- A row with `enqueuedAt !== undefined`, including zero, has grey text and a small
  `cloud_upload` icon in the category cell. The icon has `role="img"`, `aria-hidden="false"`,
  and `aria-label="Not sent yet"`. It remains visible when the date column is hidden.
  Pending and failed records use the same display. Plain saved and aggregate rows have no icon.
- The header checkbox has an indeterminate state; rows whose category is `TOTAL` get no
  checkbox.

# Drag gesture

Rows are `cdkDrag` locked to the x axis, disabled unless `draggable()`. Beyond 100 px,
`isDelete` shows a delete placeholder; on drop the row is moved off-screen and `deleteRow`
emits, otherwise it `reset()`s. `dragging` clears 250 ms after drop.

The flung row is stored in `lastDeletedDragRow`; an `effect()` on `dataSource()` resets it on
the next data change so a reused DOM row does not stay off-screen.

[^comp]: ExpensesTableComponent
