---
type: Flow
title: Add an expense
description: From the dashboard form through the write outbox to a row inserted at the top of a data sheet, and the targeted re-read that follows.
tags: [flow, expense, write, sheets]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
sources:
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.ts
    title: DashboardPageContainer
  - id: html
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.html
    title: Dashboard form template
  - id: expenses
    resource: ../../src/modules/dashboard/expenses.service.ts
    title: ExpensesService.add
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService.addExpense
  - id: outbox
    resource: ../../src/services/outbox/outbox.service.ts
    title: OutboxService
---

# The form

A Signal Forms form (`@angular/forms/signals`) over one `expenseModel` signal
`{ date, sheet, amount, category, comment, isInDebt }`.[^page] `required()` applies to
`date`, `sheet`, `amount`, `category`. Controls bind with `[formField]`:[^html]

- `date` — Material datepicker (`touchUi`, readonly input, `min` = 1 January this year);
- `sheet` — person select, labelled `title.split('_')[1]`;
- `amount` — number input; `category` — select over store categories;
- `comment` — autosizing textarea with a clear icon; `isInDebt` — checkbox.

`sheet`, `amount`, and `category` are typed `| null`, not `| undefined`: Signal Forms treats
an `undefined`-able value as an optional field, which breaks `[formField]` and `required()`.
A static `required` attribute cannot coexist with `[formField]` (`NG8022`), so Material's
asterisk is not shown.

- When the category list is empty, the select shows a **"Click to Load"** option that
  dispatches `loadCategories`; normally the list comes from localStorage.
- After submit the form resets but keeps `date` and `sheet`.

The [voice note](voice-recording.md) button after **Add Expense** is a second entry point: it
never submits the form, but each expense Gemini recognizes goes to the same
`ExpensesService.add`, so everything below applies to it too.

# Steps

1. `onSubmit` prevents native submit, returns unless the form is valid, and calls
   `ExpensesService.add(sheet.id, expense)`, then resets the form.
2. `add` never calls Google. It calls `OutboxService.add`, which builds a pending
   `OutboxRecord` (`attempts: 0`, the five expense fields, the current spreadsheet id), so
   **every** expense goes through the [write outbox](../architecture/write-outbox.md).[^expenses]
3. `OutboxService` persists the record to IndexedDB, announces "Expense saved on this
   device…", and starts a drain pass. The pass sends only when online, signed in, and a
   spreadsheet is selected; otherwise the record waits for the next trigger.[^outbox]
4. The drain sends through `SpreadsheetService.addExpense`, **one `:batchUpdate`**:[^svc]
   - `insertDimension` ROWS `[0, 1)`, `inheritFromBefore: false`;
   - `updateCells` at row 0, `fields: 'userEnteredValue'`, with the five cells from
     `toExpenseCells` ([row mapping](../domain/expense.md#row-mapping)).
5. When a pass has sent at least one record (`OutboxService.sent$`) and the router is on
   `/dashboard`, `ExpensesService` reloads the day of the last sent record
   ([load expenses](load-expenses.md)).

# Outcomes

| Path | User sees |
|---|---|
| queued, then sent | polite announcement "Expense saved on this device…", then the table reloads to that day |
| queued, cannot send yet (offline, signed out) | the announcement; outbox badge |
| send fails `retryable`/`auth` | stays pending; retried on the next trigger |
| send fails `terminal` | failure notice with Retry / Discard |
| outbox cannot persist (no IndexedDB) | toast "Couldn't save that expense. Please try again." |

The form was already reset, so an entry that could not be persisted must be retyped. A
queued expense appears in the table only after it is sent and the post-drain reload runs
(only on `/dashboard`).

The date is written as local wall-clock time; a queued expense is converted at send time
([known issues](../constraints/known-issues.md) #27).

[^html]: Dashboard form template
[^page]: DashboardPageContainer
[^expenses]: ExpensesService.add
[^svc]: SpreadsheetService.addExpense
[^outbox]: OutboxService
