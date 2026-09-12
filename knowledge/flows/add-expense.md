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

An **experimental Signal Forms** form (`@angular/forms/signals`) with five controls: `date`
(Material datepicker, `touchUi`, readonly input, `min` = 1 January of the current year),
`sheet` (person selector), `amount` (number, required), `category` (select over store
categories), `comment` (autosizing textarea), and an `isInDebt` checkbox.[^html] This is the
one form in the app that isn't template-driven — see
[code conventions](../constraints/code-conventions.md).

A single `expenseModel` signal (`{ date, sheet, amount, category, comment, isInDebt }`, with
`sheet`/`amount`/`category` typed `| null` rather than `| undefined` — Signal Forms'
`Subfields` mapping treats a value type that includes `undefined` as "the field itself may be
absent", which breaks `[formField]` binding and `required()`'s path typing) feeds `form()`.
A schema function calls `required()` on `date`, `sheet`, `amount`, and `category`. Each
Material control (`mat-select`, `mat-checkbox`, the datepicker input, `matInput`) binds via
`[formField]`, which drives them through their existing `ControlValueAccessor` — the same
interop path reactive forms uses. A static `required` attribute cannot coexist with
`[formField]` on the same element (compiler error `NG8022`), so the asterisk Material used to
render from that attribute no longer appears; validity itself is unaffected, still driven by
the schema's `required()` calls.

Two details:

- The category select renders an `@empty` option labelled **"Click to Load"** that dispatches
  `loadCategories` — categories are not fetched automatically on this page, only on the
  categories page. The cached list from localStorage normally fills it.
- On submit the form is *reset with the date and sheet preserved*
  (`expenseForm().reset({ ...blank, date, sheet })`) so a run of entries for the same day and
  person needs no re-selection.

# Steps

1. `onSubmit(event)` prevents the native submit, returns early unless
   `expenseForm().valid()`, then dispatches
   `addExpense({ expense: expenseForm().value(), sheetId: sheet.id })`.[^page]
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
  [delete](delete-expense.md) relies on.
- The follow-up read narrows to the submitted expense's day. If the user had a wider range
  displayed (for example after picking an older date), the table collapses to that day.
- `exhaustMap` means a double-tap on **Add Expense** while the first write is in flight is
  dropped, which is the de-facto duplicate guard.
- A failure logs, clears `loading`, and dispatches `operationFailed({ source: 'addExpense$',
  message: "Couldn't save that expense. Please try again." })` (opens a snackbar via
  `reportFailure`), then returns `EMPTY`. The typed values are already gone from the form
  because the reset happens optimistically on submit, and this effect's `catchError` cannot
  restore them. Note also: after the *first* failure of `addExpense$` in a session, the
  effect's stream is complete and further submits silently do nothing (no toast either) —
  see [known issues](../constraints/known-issues.md) item 21.
- The date written is the local wall-clock time; see
  [date encoding](../domain/spreadsheet-layout.md).

[^html]: Dashboard form template
[^page]: DashboardPageContainer
[^svc]: SpreadsheetService.addExpense
