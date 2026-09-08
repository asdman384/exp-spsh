---
type: Component Contract
title: ExpensesTableComponent
description: The shared table used by both the dashboard and statistics - its inputs, outputs, dynamic column rules, and drag-to-delete gesture.
tags: [interface, component, table, drag-drop]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: comp
    resource: ../../src/shared/components/expenses-table/expenses-table.component.ts
    title: ExpensesTableComponent
  - id: html
    resource: ../../src/shared/components/expenses-table/expenses-table.component.html
    title: Table template
---

`<expenses-table>` is the only shared feature component. It is `OnPush` and imports
`UIKitModule`.[^comp]

# Inputs

| Input | Type | Default | Meaning |
|---|---|---|---|
| `dataSource` | `ReadonlyArray<Expense>` | `[]` | rows to render |
| `showDateCol` | `boolean` | `true` | force-hide the date column (dashboard passes `false`) |
| `draggable` | `boolean` | `false` | enable the swipe-to-delete gesture |
| `selectable` | `boolean` | `false` | show the checkbox column |
| `selected` | `ReadonlyArray<Expense>` | — | setter that clears and re-selects; getter returns `selection.selected` |

# Outputs

| Output | Payload | Used by |
|---|---|---|
| `onDeleteRow` | `Expense` | dashboard -> [delete flow](../flows/delete-expense.md) |
| `onCellClick` | `{ field: keyof Expense; cellData: unknown; rowData: Expense }` | statistics drill-down |
| `onSelection` | `ReadonlyArray<Expense>` | statistics total (constructed with `async: true`) |

`onCellClick` is wired **only on the category cell** in the template, even though the payload
is generic.

# Dynamic columns

`DEFAULT_COLS = ['date','category','amount','comment','isInDebt']`. On every `dataSource`
change `defineCols` rebuilds the column list:

1. prepend `select` when `selectable`;
2. keep a default column only if **some row has a defined value for it**
   (`exps.some(e => e[field] !== undefined)`) and it is not hidden by `showDateCol`.

This is why [statistics](../flows/statistics.md) can reuse the table: aggregate rows carry only
`category` + `amount`, so the other columns disappear on their own, and the drill-down
projection (`amount`, `comment`, `date`) swaps them back.

> `ngOnChanges` reads `changes['dataSource'].currentValue` unconditionally, so the component
> **throws if any other input changes alone** on a change-detection pass where `dataSource`
> is absent. Current call sites always bind `dataSource`, which is what keeps this working.

# Rendering details

- `date` renders `dd MMM` with a `dd MMM HH:mm` tooltip (`DATE_FORMAT` / `DATE_TIME_FORMAT`
  from `src/constants/UI.ts`); the tooltip is positioned `above` with
  `matTooltipTouchGestures="auto"` for mobile.
- `comment` is line-clamped with the full text in a tooltip.
- `isInDebt` renders a `check` icon when true, nothing otherwise.
- The `select` header checkbox supports an indeterminate state; rows whose category is the
  literal `TOTAL` get no checkbox.

# Drag gesture

Rows are `cdkDrag` with `cdkDragLockAxis="x"` and `[cdkDragDisabled]="!draggable"`.
`DELETE_THRESHOLD = 100` px of horizontal travel arms the delete: `cdkDragMoved` flips
`isDelete` (which swaps the floating placeholder to a delete icon), and `cdkDragEnded`
either flings the row off-screen and emits `onDeleteRow`, or calls `reset()`. The
`dragging` flag is cleared 250 ms after drop so the placeholder can animate out.

`lastDeletedDragRow` is remembered so the next `dataSource` change can `reset()` the flung
row's transform — otherwise a re-used DOM row would render off-screen.

Selection changes are pushed through `SelectionModel.changed` with `takeUntilDestroyed()`,
and both toggle handlers call `cdRef.detectChanges()` explicitly because the component is
`OnPush` and the model mutates outside Angular's input flow.

[^comp]: ExpensesTableComponent
