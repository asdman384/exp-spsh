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
statistics. It imports `DatePipe`, `DragDropModule`, and Material checkbox, icon, table, and
tooltip modules directly.[^comp]

# Inputs

All are `input()` signals; none is required.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `dataSource` | `ReadonlyArray<Expense>` | `[]` | rows to render |
| `showDateCol` | `boolean` | `true` | `false` hides the date column (dashboard) |
| `draggable` | `boolean` | `false` | enables swipe-to-delete |
| `selectable` | `boolean` | `false` | adds the checkbox column |
| `selected` | `ReadonlyArray<Expense>` | `[]` | rows to pre-select; an `effect()` clears the `SelectionModel` and re-selects on change |

# Outputs

| Output | Payload | Used by |
|---|---|---|
| `deleteRow` | `Expense` | dashboard → [delete flow](../flows/delete-expense.md) |
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

- `date`: `dd MMM`, tooltip `dd MMM HH:mm` (`DATE_FORMAT` / `DATE_TIME_FORMAT`).
- `comment`: line-clamped, full text in a tooltip.
- `isInDebt`: a `check` icon when true.
- The header checkbox has an indeterminate state; rows whose category is `TOTAL` get no
  checkbox.

# Drag gesture

Rows are `cdkDrag` locked to the x axis, disabled unless `draggable()`. Beyond 100 px,
`isDelete` shows a delete placeholder; on drop the row is moved off-screen and `deleteRow`
emits, otherwise it `reset()`s. `dragging` clears 250 ms after drop.

The flung row is stored in `lastDeletedDragRow`; an `effect()` on `dataSource()` resets it on
the next data change so a reused DOM row does not stay off-screen.

[^comp]: ExpensesTableComponent
