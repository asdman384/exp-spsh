---
type: Flow
title: Delete an expense
description: Swipe-to-delete with an optimistic store update, a re-read to resolve the row index, and rollback on failure.
tags: [flow, expense, delete, optimistic-update]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: deleteExpense$
  - id: table
    resource: ../../src/shared/components/expenses-table/expenses-table.component.ts
    title: ExpensesTableComponent drag handling
  - id: helpers
    resource: ../../src/shared/helpers/index.ts
    title: isExpenseEqual
  - id: commit
    resource: ../../.git
    title: commit 2ddd6c5 "delete expense - implement optimistic update"
---

# Trigger

Only on the dashboard, where the table is rendered with `[draggable]="true"`. The user drags
a row horizontally (`cdkDragLockAxis="x"`); when the drag ends past
`DELETE_THRESHOLD = 100` px the row is flung off-screen
(`setFreeDragPosition({ x: window.outerWidth, y: 0 })`) and `onDeleteRow` emits. Below the
threshold the row springs back via `event.source.reset()`. A placeholder showing a delete
icon tracks the row while dragging.[^table]

The container forwards it as `deleteExpense({ expense, sheet })` using the **current** sheet.

# Steps

`deleteExpense$` is the most intricate effect in the app.[^effects]

1. **Optimistic removal.** Find the expense in the current `expenses` array with
   [`isExpenseEqual`](/domain/expense.md); if found, save
   `deletedExpenseBackup = { expense, index }` and dispatch `storeExpenses` without it. If
   not found, clear the backup (nothing to roll back).
2. **Resolve the real row.** Set `loading = true` and call
   `loadLastExpenses(sheet.title, 100)` — a `values.get` over `A1:E100` of that tab.
3. **Delete by index.** Find the matching row in that fresh array; its array index *is* the
   sheet row index because the sheet is newest-first and the read starts at row 1. Issue
   `deleteSheetRow(sheet.id, i)` -> `deleteDimension` for `[i, i+1)`. If no match is found,
   emit `of(undefined)` and **do nothing** — a silent no-op.
4. **Settle.** Clear the backup and emit `loading(false)`.
5. **Rollback.** On any error: log it, and if a backup exists, re-read the current expenses,
   splice the row back at `min(backup.index, length)` when it is not already present, clear
   `loading`, and dispatch `storeExpenses` with the restored array.

# Constraints this flow carries

- **Only the newest 100 rows are deletable.** Anything older is not found in step 3 and the
  delete silently succeeds in the UI (the optimistic removal already happened) while the row
  survives in the spreadsheet — until the next read brings it back.
- **The row index is positional.** If the sheet is edited or sorted in Google Sheets between
  step 2 and step 3, the wrong row can be deleted. The re-read in step 2 exists precisely to
  narrow that window.
- **Duplicate rows are ambiguous.** Two identical expenses (same second, amount, category,
  comment) match the same index; the first is removed.
- The whole flow uses `exhaustMap`, so a second swipe during an in-flight delete is dropped —
  which also means the second row stays visually flung off-screen until the next data change
  resets it (`ngOnChanges` calls `lastDeletedDragRow.reset()`).

There is no confirmation dialog; `ExpDialogComponent` exists but is not wired to this flow.

[^table]: ExpensesTableComponent drag handling
[^effects]: deleteExpense$
