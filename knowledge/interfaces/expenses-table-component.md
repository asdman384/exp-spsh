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
  - id: styles
    resource: ../../src/shared/components/expenses-table/expenses-table.component.scss
    title: Amount cell layout
  - id: html
    resource: ../../src/shared/components/expenses-table/expenses-table.component.html
    title: Table template
---

`<expenses-table>` displays Dashboard expenses, the Statistics month summary,
and the entries for one category. The shared table
imports `DatePipe`, `DecimalPipe`, `DragDropModule`, and Material checkbox, icon, table, and
tooltip modules directly.[^comp]

`ExpenseTableRow` extends `Expense` with optional numeric `enqueuedAt`, `share`, and `delta`
and an optional boolean `previousOnly`. Plain expenses are valid inputs. Drag data and the
delete output retain the original row and its display metadata.[^comp]

# Inputs

All are `input()` signals; none is required.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `dataSource` | `ReadonlyArray<ExpenseTableRow>` | `[]` | rows to render |
| `showDateCol` | `boolean` | `true` | `false` hides the date column (dashboard) |
| `draggable` | `boolean` | `false` | enables swipe-to-delete |
| `selectable` | `boolean` | `false` | adds the checkbox column |
| `summaryMonthLabel` | `string` | omitted | supplies the comparison month label and enables summary columns |
| `selected` | `ReadonlyArray<Expense>` | `[]` | rows to pre-select; an `effect()` clears the `SelectionModel` and re-selects on change |

# Outputs

| Output | Payload | Behavior |
|---|---|---|
| `deleteRow` | `ExpenseTableRow` | dashboard → [delete flow](../flows/delete-expense.md) |
| `cellClick` | `{ field, cellData, rowData }` | reports a category cell click in the default table |
| `summarySelectionToggle` | `string \| null` | synchronously reports the category whose checkbox changed, or `null` for the header |
| `selectionChange` | `ReadonlyArray<Expense>` | emits the selected rows after a change |

`selectionChange` is `outputFromObservable()` over `selection.changed`, delayed with
`delay(0)`. The Statistics page calculates its totals from page data.
Updating `selected` synchronizes the checkboxes without emitting `summarySelectionToggle`.

# Dynamic columns

With the default inputs, the table selects columns in this order:

1. `select` first when `selectable()`;
2. then each of `date`, `category`, `amount`, `comment`, `isInDebt` that has data and is not
   hidden — "has data" means some row's value is not `undefined`, except `isInDebt`, which
   needs some row with `true`.

The Statistics detail projection supplies `date`, `amount`, and `comment`.
The Dashboard shows the **Debt** column when a debt row exists.

With `summaryMonthLabel`, the table always shows Category, Amount, Share, and
`vs <label>`. When `selectable` is true, the checkbox column comes first.
Summary rows use the category name for tracking and expose it in `data-category`.
The page handles activation of the category button and clicks elsewhere on the row
outside the checkbox cell.

# Rendering

In the default table, amount cells keep their table-cell layout. Their inner `.column-amount-container` uses
`display: flex` with a 10 px gap to place amount, share, and delta on one line.
Material's generated `mat-column-amount` class sets the minimum column width from
`--exp-table-amount-column-min-width`.

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
- A partial selection gives the header checkbox an indeterminate state. The default table
  omits the row checkbox for `TOTAL`. In the summary, every category has a checkbox in
  selection mode, including `TOTAL`. An empty summary disables the header checkbox.
- Summary amounts have weight 600. Shares and signed changes occupy separate right-aligned
  cells. A previous-only row uses gray text for the category and all three numbers.

# Drag gesture

Rows are `cdkDrag` locked to the x axis, disabled unless `draggable()`. Beyond 100 px to the right,
`isDelete` shows a delete placeholder; on drop the row is moved off-screen and `deleteRow`
emits, otherwise it `reset()`s. `dragging` clears 250 ms after drop.

The flung row is stored in `lastDeletedDragRow`; an `effect()` on `dataSource()` resets it on
the next data change so a reused DOM row does not stay off-screen.

[^comp]: ExpensesTableComponent
