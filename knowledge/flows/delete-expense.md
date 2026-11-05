---
type: Flow
title: Delete an expense
description: Swipe-to-delete with an optimistic list update, a re-read to resolve the row index, and rollback on failure.
tags: [flow, expense, delete, optimistic-update]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: expenses
    resource: ../../src/modules/dashboard/expenses.service.ts
    title: ExpensesService.delete
  - id: table
    resource: ../../src/shared/components/expenses-table/expenses-table.component.ts
    title: ExpensesTableComponent drag handling
  - id: dashboard
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.view-model.ts
    title: DashboardPageViewModel.deleteExpense
  - id: outbox
    resource: ../../src/services/outbox/outbox.service.ts
    title: OutboxService.discard
  - id: helpers
    resource: ../../src/shared/helpers/index.ts
    title: isExpenseEqual
---

# Trigger

Dashboard only (`[draggable]="true"`). A row dragged horizontally past 100 px is flung
off-screen and `deleteRow` emits; below that it springs back.[^table] The container
calls `DashboardPageViewModel.deleteExpense`. There is no confirmation.[^dashboard]

# Queued rows

An `enqueuedAt` field, including zero, marks a queued row. The view-model finds one current
record by selected spreadsheet, numeric person ID, addition time, full expense date, amount,
category, comment, and debt. It removes the first matching record with
`OutboxService.discard(localId)`. This works offline for pending and failed records. An
absent match causes no remote delete. Identical records lose only one entry per swipe.
Storage removal completes before records and totals update. A removal failure logs the error
and retains the record. There is no undo or active-send coordination.[^dashboard][^outbox]

# Saved rows

Saved rows use `ExpensesService.delete(sheet, expense)` with the current sheet.
This remote operation is not queued.

# Steps

`ExpensesService.delete`:[^expenses]

1. **Optimistic removal.** Find the expense in the `expenses` signal with
   [`isExpenseEqual`](../domain/expense.md#identity). If found, keep `{ expense, index }` as
   a backup and remove it from the signal.
2. **Resolve the row.** `loading(true)`; `loadLastExpenses(sheet.title, 100)` — `values.get`
   over `A1:E100`.
3. **Delete by index.** The matching index in that array is the sheet row index (newest-first,
   no header). `deleteSheetRow(sheet.id, i)` → `deleteDimension [i, i+1)`. No match throws
   `cannot find expense in the last 100 rows`.
4. **Success.** `loading(false)`.
5. **Failure** (any error, including step 3's throw): log it, dispatch
   `operationFailed` ("Couldn't delete that expense. It's back in your list."), and clear
   `loading`. If there is a backup, re-insert the row into the signal at `min(index, length)`
   unless it is already present. The toast source stays `deleteExpense$`.

The dashboard totals react to optimistic removal and rollback through the same expense signal.

# Constraints

- **Only the newest 100 rows are deletable**; older ones roll back with the toast
  ([known issues](../constraints/known-issues.md) #2).
- **The index is positional.** Editing or sorting the sheet between steps 2 and 3 can delete
  the wrong row (#3).
- **Duplicates are ambiguous**: identical expenses match the first row.
- `exhaustMap` drops a second swipe during an in-flight delete; that row stays flung until the
  next `dataSource` change, when the table's `effect()` resets it.

[^table]: ExpensesTableComponent drag handling
[^expenses]: ExpensesService.delete

[^dashboard]: DashboardPageViewModel.deleteExpense
[^outbox]: OutboxService.discard
