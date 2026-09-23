---
type: Flow
title: Add an expense
description: From the dashboard form to a row inserted at the top of a data sheet (live or via the outbox), and the targeted re-read that follows.
tags: [flow, expense, write, sheets]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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
  - id: outbox
    resource: ../../src/@state/outbox.effects.ts
    title: OutboxEffects
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

The last `.submit-row`, after the **Add Expense** button, also holds `<voice-record-button>` —
the [hold-to-record voice note](voice-recording.md) button. It is unrelated to this form: it
never dispatches `addExpense` or calls `onSubmit`, and its recording is not attached to the
expense in any way.

# Steps

1. `onSubmit` prevents native submit, returns unless the form is valid, and dispatches
   `addExpense({ expense, sheetId: sheet.id })`, then resets the form.
2. `addExpense$` writes live, or queues in the [write outbox](../architecture/write-outbox.md)
   when offline or when records are already pending.[^effects]
3. A live write sets `loading`, then `SpreadsheetService.addExpense` sends **one
   `:batchUpdate`**:[^svc]
   - `insertDimension` ROWS `[0, 1)`, `inheritFromBefore: false`;
   - `updateCells` at row 0, `fields: 'userEnteredValue'`, with the five cells from
     `toExpenseCells` ([row mapping](../domain/expense.md#row-mapping)).

   A queued expense is later sent through the same call.
4. On live success the effect dispatches `loadExpenses({ sheetId, from: date, to: date + 1 day })`,
   which replaces the table with that one day. `loadExpenses$` clears `loading`.

# Outcomes

| Path | `loading` | User sees |
|---|---|---|
| live success | on → off | table reloads to that day |
| offline, or behind the queue | untouched | polite announcement "Expense saved on this device…"; outbox badge |
| live fails `retryable`/`auth` | on → off | queued as above |
| live fails `terminal` | on → off | toast "Couldn't save that expense. Please try again." |
| outbox cannot persist | — | same toast |

The form was already reset, so a failed entry must be retyped. A queued expense appears in
the table only after it is sent and the post-drain reload runs (only on `/dashboard`).[^outbox]

`exhaustMap` drops a second **Add Expense** while a live write is in flight.

The date is written as local wall-clock time; a queued expense is converted at send time
([known issues](../constraints/known-issues.md) #27).

[^html]: Dashboard form template
[^page]: DashboardPageContainer
[^effects]: addExpense$
[^svc]: SpreadsheetService.addExpense
[^outbox]: OutboxEffects
