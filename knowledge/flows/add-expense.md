---
type: Flow
title: Add an expense
description: From the dashboard form to a row inserted at the top of a data sheet, and the targeted re-read that follows.
tags: [flow, expense, write, sheets]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.ts
    title: DashboardPageContainer
  - id: html
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.html
    title: Dashboard form template
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: addExpense$
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService.addExpense
---

# The form

A template-driven `ngForm` with five controls: `date` (Material datepicker, `touchUi`,
readonly input, `min` = 1 January of the current year), `sheet` (person selector),
`amount` (number, required), `category` (select over store categories), `comment`
(autosizing textarea), and an `isInDebt` checkbox.[^html]

Two details:

- The category select renders an `@empty` option labelled **"Click to Load"** that dispatches
  `loadCategories` — categories are not fetched automatically on this page, only on the
  categories page. The cached list from localStorage normally fills it.
- On submit the form is *reset with the date and sheet preserved*
  (`form.resetForm({ date, sheet, amount: undefined, ... })`) so a run of entries for the
  same day and person needs no re-selection.

# Steps

1. `onSubmit(form)` returns early unless `form.valid`, then dispatches
   `addExpense({ expense: form.value, sheetId: sheet.id })`.[^page]
2. `addExpense$` sets `loading = true` and calls
   `SpreadsheetService.addExpense(sheetId, expense)`.
3. That issues **one `:batchUpdate`** with two requests:[^svc]
   - `insertDimension` — ROWS, `startIndex: 0`, `endIndex: 1`, `inheritFromBefore: false`
     (a blank row at the very top, not inheriting formatting from below);
   - `updateCells` — `fields: 'userEnteredValue'` at row 0, writing
     A=`category` (string), B=`comment` (string), C=`amount` (number),
     D=`getSerialNumberFromDate(date)` (number),
     E=`amount` **only when `isInDebt`**, otherwise `undefined`.
4. On success the effect maps to `loadExpenses({ sheetId, from: expense.date, to: date+1 })`
   — a **one-day** re-read that replaces the table contents rather than patching state
   locally. `loading` is cleared by `loadExpenses$`.

# Notes and consequences

- Because the write is an insert at row 0, sheets are ordered newest-first, which
  [delete](/flows/delete-expense.md) relies on.
- The follow-up read narrows to the submitted expense's day. If the user had a wider range
  displayed (for example after picking an older date), the table collapses to that day.
- `exhaustMap` means a double-tap on **Add Expense** while the first write is in flight is
  dropped, which is the de-facto duplicate guard.
- A failure leaves nothing in the UI: `catchError` logs, clears `loading`, and returns
  `EMPTY`. The typed values are already gone from the form because the reset happens
  optimistically on submit.
- The date written is the local wall-clock time; see
  [date encoding](/domain/spreadsheet-layout.md).

[^html]: Dashboard form template
[^page]: DashboardPageContainer
[^svc]: SpreadsheetService.addExpense
