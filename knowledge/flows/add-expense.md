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
  - id: vm
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.view-model.ts
    title: DashboardPageViewModel
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
`{ date, sheet, amount, category, comment, isInDebt }` owned by the page-scoped
`DashboardPageViewModel`. The component owns form validation and display bindings.[^page][^vm] `required()` applies to
`date`, `sheet`, `amount`, `category`. Controls bind with `[formField]`:[^html]

- `date` — Material datepicker (`touchUi`, readonly input, no lower date bound);
- `sheet` — person select, labelled `title.split('_')[1]`;
- `amount` — number input; `category` — select over store categories;
- `comment` — autosizing textarea with a clear icon; `isInDebt` — checkbox.

The Date field has a transparent swipe button over it. A horizontal gesture of at least
40 CSS pixels logs `Date swipe` and `left` or `right` in the component and runs a wave in
that direction. Left subtracts one local calendar day from the selected date; right adds one.
The handler calls `changeDate`, which updates the date and loads expenses for the selected
person. Swipes do not open the calendar. A tap opens the calendar.
Vertical gestures can scroll the page. Left and right arrow keys also run the handler.
The wave has zero duration when the user requests reduced motion.[^page][^html]

`sheet`, `amount`, and `category` are typed `| null`, not `| undefined`: Signal Forms treats
an `undefined`-able value as an optional field, which breaks `[formField]` and `required()`.
A static `required` attribute cannot coexist with `[formField]` (`NG8022`), so Material's
asterisk is not shown.

- When the category list is empty, the select shows a **"Click to Load"** option that
  dispatches `loadCategories`; normally the list comes from localStorage.
- An automatic date uses the current local time at submit. On a visible next-day resume,
  it moves to today and reloads the selected person's month through today.
- A date selected in the calendar or with **Yesterday** stays selected through submit and
  resume. Yesterday means the previous local calendar day, including across a year boundary.
- After submit the form resets but keeps the resolved `date`, date mode, and `sheet`.
  A new Dashboard page starts in automatic date mode.

The [voice note](voice-recording.md) button after **Add Expense** is a second entry point: it
never submits the form, but each expense Gemini recognizes goes to the same
`ExpensesService.add`, so everything below applies to it too.

# Steps

1. `onSubmit` prevents native submit, returns unless the form is valid, and calls
   `DashboardPageViewModel.saveExpense()`, which calls `ExpensesService.add(sheet.id, expense)`
   and resets the model while retaining date and sheet. The component resets form interaction state.
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
   `/dashboard`, `ExpensesService` reloads the month through the date of the last sent record
   ([load expenses](load-expenses.md)).

# Outcomes

| Path | User sees |
|---|---|
| queued, then sent | a grey row and applicable totals after persistence, then a normal row after the saved list reloads |
| queued, cannot send yet (offline, signed out) | the announcement, outbox badge, and grey row in the selected Dashboard scope |
| send fails `retryable`/`auth` | stays pending; retried on the next trigger |
| send fails `terminal` | failure notice with Retry / Discard |
| outbox cannot persist (no IndexedDB) | toast "Couldn't save that expense. Please try again." |

The form was already reset, so an entry that could not be persisted must be retyped. A
queued expense appears in the Dashboard list and applicable totals after local persistence.
This applies to form and voice entries. Pending and failed records remain visible for the
selected spreadsheet, person, and day. Earlier days in the month contribute only to monthly
and debt totals. A local discard removes the contribution. After successful send removal,
the row can disappear until the saved-list reload completes. Statistics uses saved rows only.[^vm]

The date is written as local wall-clock time; a queued expense is converted at send time
([known issues](../constraints/known-issues.md) #27).

[^html]: Dashboard form template
[^page]: DashboardPageContainer
[^expenses]: ExpensesService.add
[^svc]: SpreadsheetService.addExpense
[^outbox]: OutboxService

[^vm]: DashboardPageViewModel
