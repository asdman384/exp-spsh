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
`DatePipe`, `DragDropModule`, `MatCheckboxModule`, `MatIconModule`, `MatTableModule`, and
`MatTooltipModule` directly — there is no shared UI-kit module to pull these in (see
[dependency wiring](../architecture/dependency-wiring.md)).[^comp]

# Inputs

All five are `input()` signals, read with `()`; none is required.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `dataSource` | `InputSignal<ReadonlyArray<Expense>>` | `[]` | rows to render |
| `showDateCol` | `InputSignal<boolean>` | `true` | force-hide the date column (dashboard passes `false`) |
| `draggable` | `InputSignal<boolean>` | `false` | enable the swipe-to-delete gesture |
| `selectable` | `InputSignal<boolean>` | `false` | show the checkbox column |
| `selected` | `InputSignal<ReadonlyArray<Expense>>` | `[]` | rows to pre-select; a component `effect()` clears the `SelectionModel` and re-selects it whenever the signal changes |

# Outputs

| Output | Payload | Used by |
|---|---|---|
| `deleteRow` | `Expense` | dashboard -> [delete flow](../flows/delete-expense.md) |
| `cellClick` | `{ field: keyof Expense; cellData: unknown; rowData: Expense }` | statistics drill-down |
| `selectionChange` | `ReadonlyArray<Expense>` | statistics total |

`deleteRow` and `cellClick` are plain `output()`s, emitted synchronously from DOM event
handlers. `selectionChange` is `outputFromObservable()` over `selection.changed`, mapped to
`selection.selected` and deferred by one macrotask (`delay(0)`), reproducing the async
`EventEmitter(true)` semantics this output relies on: the `selected` effect above and the
`toggle*` handlers both mutate `selection` during the component's own change detection, so a
synchronous emission back into the parent (which reads `total` after `<expenses-table>` in its
template) would risk `NG0100`.

`cellClick` is wired **only on the category cell** in the template, even though the payload
is generic.

# Dynamic columns

`DEFAULT_COLS = ['date','category','amount','comment','isInDebt']`. `columns` is a
`computed()` over `dataSource()`, `selectable()`, and `showDateCol()`:

1. prepend `select` when `selectable()`;
2. keep a default column only if **some row has a defined value for it**
   (`exps.some(e => e[field] !== undefined)`) and it is not hidden by `showDateCol()`.

This is why [statistics](../flows/statistics.md) can reuse the table: aggregate rows carry only
`category` + `amount`, so the other columns disappear on their own, and the drill-down
projection (`amount`, `comment`, `date`) swaps them back. Because it is a `computed()`, columns
also recompute if `selectable` or `showDateCol` change on their own, not only alongside
`dataSource`.

# Rendering details

- `date` renders `dd MMM` with a `dd MMM HH:mm` tooltip (`DATE_FORMAT` / `DATE_TIME_FORMAT`
  from `src/constants/UI.ts`); the tooltip is positioned `above` with
  `matTooltipTouchGestures="auto"` for mobile.
- `comment` is line-clamped with the full text in a tooltip.
- `isInDebt` renders a `check` icon when true, nothing otherwise.
- The `select` header checkbox supports an indeterminate state; rows whose category is the
  literal `TOTAL` get no checkbox.

# Drag gesture

Rows are `cdkDrag` with `cdkDragLockAxis="x"` and `[cdkDragDisabled]="!draggable()"`.
`DELETE_THRESHOLD = 100` px of horizontal travel arms the delete: `cdkDragMoved` flips
`isDelete` (which swaps the floating placeholder to a delete icon), and `cdkDragEnded`
either flings the row off-screen and emits `deleteRow`, or calls `reset()`. The
`dragging` flag is cleared 250 ms after drop so the placeholder can animate out.

`lastDeletedDragRow` is remembered so a component `effect()` tracking `dataSource()` can
`reset()` the flung row's transform on the next data change — otherwise a re-used DOM row
would render off-screen.

Selection changes are pushed through `SelectionModel.changed` into `selectionChange` (see
Outputs above), and both toggle handlers call `cdRef.detectChanges()` explicitly because the
component is `OnPush` and the model mutates outside Angular's input flow.

[^comp]: ExpensesTableComponent
