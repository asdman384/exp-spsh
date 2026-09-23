---
type: Flow
title: Delete an expense
description: Swipe-to-delete with an optimistic store update, a re-read to resolve the row index, and rollback on failure.
tags: [flow, expense, delete, optimistic-update]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: deleteExpense$
  - id: table
    resource: ../../src/shared/components/expenses-table/expenses-table.component.ts
    title: ExpensesTableComponent drag handling
  - id: helpers
    resource: ../../src/shared/helpers/index.ts
    title: isExpenseEqual, Memento
---

# Trigger

Dashboard only (`[draggable]="true"`). A row dragged horizontally past 100 px is flung
off-screen and `deleteRow` emits; below that it springs back.[^table] The container
dispatches `deleteExpense({ expense, sheet })` with the current sheet. There is no
confirmation and no offline queueing.

# Steps

`deleteExpense$`:[^effects]

1. **Optimistic removal.** Find the expense in `expenses` with
   [`isExpenseEqual`](../domain/expense.md#identity). If found, save `{ expense, index }` in
   a `Memento` and dispatch `storeExpenses` without it; otherwise clear the memento.
2. **Resolve the row.** `loading(true)`; `loadLastExpenses(sheet.title, 100)` — `values.get`
   over `A1:E100`.
3. **Delete by index.** The matching index in that array is the sheet row index (newest-first,
   no header). `deleteSheetRow(sheet.id, i)` → `deleteDimension [i, i+1)`. No match throws
   `cannot find expense in the last 100 rows`.
4. **Success.** Clear the memento; `loading(false)`.
5. **Failure** (any error, including step 3's throw): log it, dispatch
   `operationFailed` ("Couldn't delete that expense. It's back in your list."), and clear
   `loading`. If the memento holds a backup, re-insert the row at `min(index, length)` unless
   it is already present, via `storeExpenses`.

# Constraints

- **Only the newest 100 rows are deletable**; older ones roll back with the toast
  ([known issues](../constraints/known-issues.md) #2).
- **The index is positional.** Editing or sorting the sheet between steps 2 and 3 can delete
  the wrong row (#3).
- **Duplicates are ambiguous**: identical expenses match the first row.
- `exhaustMap` drops a second swipe during an in-flight delete; that row stays flung until the
  next `dataSource` change, when the table's `effect()` resets it.

[^table]: ExpensesTableComponent drag handling
[^effects]: deleteExpense$
