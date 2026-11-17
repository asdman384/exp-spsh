# 2026-11-05: Show Queued Expenses With Offline Discard

**Status:** implemented; user UI review pending
**Priority:**
**Type:** feature
**Module(s):** client
**Owner:** Oleg
**Created:** 2026-11-05

## Description

Source: `docs/ideas/2026-10-25-spending-expert.md`, idea 1, "Show queued expenses in the list immediately, with offline discard".

Source idea (verbatim):

> Merge pending outbox records for the current person and day into the dashboard
> table as greyed rows with a small cloud icon ("not sent yet"). Swiping a pending row
> discards it from the outbox, and that works offline. When the record is sent, the
> grey row turns into the real one.

Users cannot see a new expense until the app sends it and loads the list again. This can cause duplicate entries. Show expenses from the form and from voice recognition as soon as they enter the outbox.

The owner requires a small change that uses the existing signals. The decisions below refine the source idea. Keep the existing send rules. Show both `pending` and `failed` outbox records in the list and totals.

## Functional Requirements

- **FR1 — List:** Add outbox expenses with status `pending` or `failed` to the Dashboard list for the selected spreadsheet, person, and day. Show unsent expenses as grey rows with a small cloud icon that means "not sent yet". Keep the current list order; do not introduce a new date sort. Do not add a separate group. A change from `pending` to `failed` must not hide the row.
- **FR2 — Discard:** Use the existing swipe action to remove a pending or failed expense from the outbox. This action must work offline and must not send a spreadsheet delete request. Do not add a confirmation or an undo action. Do not add handling for a discard during an active send request.
- **FR3 — Totals:** Include outbox expenses with status `pending` or `failed` in the existing Dashboard totals. Add the outbox signal as an input to the existing computed signals. Keep the current date ranges, person selection, debt rules, and number formats. A discarded expense must no longer contribute to these totals. A change from `pending` to `failed` must not change its contribution.
- **FR4 — Send errors:** Keep the existing send rules and error classification. Temporary network errors and authorization errors keep the record in `pending`. Existing send triggers control the next attempt. Records with status `failed` still need the existing Retry action before another send attempt. Do not add automatic retries for failed records, new error actions, or new error UI.
- **FR5 — Successful send:** After a successful send and list reload, show the saved expense as a normal row. Keep the existing send and reload flow. The row can temporarily disappear after removal from the outbox and before the saved list loads. This gap is accepted. Do not add code to keep the row visible during this gap. Do not add a new transition status or a separate transition mechanism.

## Non-Functional Requirements

- Use the existing outbox and Dashboard signals. Do not add a new state store or a new architecture layer.
- Keep code changes to the minimum needed for these requirements.
- Do not change the spreadsheet format.
- Keep the queued-row merge in the Dashboard. Do not add queued expenses to Statistics through the shared expense service.
- Keep grey rows readable and give the cloud icon an accessible name of "Not sent yet".

## Acceptance Criteria

- [ ] **FR1:** With no network connection, add an expense through the form. After the outbox saves it, the selected day's list shows it with the pending style.
- [ ] **FR1:** Expenses from voice recognition appear with the same pending style when they enter the outbox.
- [ ] **FR1:** Pending and failed rows follow the current list order without a new date sort. Rows from another spreadsheet, person, or day do not appear in the selected day's list.
- [ ] **FR1:** Pending and failed expenses that remain in the outbox appear again after the app reloads and restores the outbox.
- [ ] **FR1, FR3:** A record changes from `pending` to `failed`. Its row remains visible, and its amount remains in the applicable totals.
- [ ] **FR2:** Swipe a pending or failed row while offline. The row is removed from the list and outbox without confirmation or a spreadsheet delete request. It does not return after a reload and is not sent when the connection returns.
- [ ] **FR3:** Add or discard a pending expense. The applicable daily, monthly, and debt totals update through the existing computed signals. Existing date ranges and formats stay the same.
- [ ] **FR4:** A send error does not remove the expense from the outbox. Temporary network errors and authorization errors keep the record in `pending`. Failed records need the existing Retry action. Error classification and send triggers stay the same. This task adds no error UI.
- [ ] **FR5:** After a successful send and list reload, one saved row replaces the outbox row. The final totals do not count both rows. A temporary gap before the saved list loads is accepted and needs no additional handling.
- [ ] **FR3:** Queued expenses from earlier days in the selected month contribute to monthly and debt totals, but not to the selected day's list or daily total. Expenses after the selected day, in another month, for another person, or in another spreadsheet do not contribute.
- [ ] **FR1:** The cloud icon is visible when the Dashboard date column is hidden and exposes the accessible name "Not sent yet".

## Common sense considerations

- Match outbox records by the selected person's numeric sheet ID; do not use the sheet title as the numeric ID.
- Use the record's addition time to identify the queued row in the Dashboard, as requested by the owner; do not require a `localId` field in the table row. Keep the existing outbox storage format.
- Include both `pending` and `failed` records in each applicable total, including signed debt amounts.
- Keep the existing no-person totals placeholder and include no queued records when no person is selected.
- Keep the existing discard storage-error behavior: log the error and retain the record when removal fails; add no new error UI.

## Notes

**2026-11-05:** The owner confirmed time order, no discard confirmation, no handling for discard during an active send, inclusion in existing totals, and a minimal send transition. The owner requires clarification instead of assumptions.

**2026-11-05:** The owner confirmed that the existing send rules must stay the same.

**2026-11-05:** The owner confirmed that failed records must also appear in the list and totals.

**2026-11-05:** The owner accepted temporary row disappearance between removal from the outbox and completion of the list reload. Do not add logic to prevent this gap.

The outbox already exposes its records through a read-only signal. The Dashboard can use this signal for the list and totals. The existing discard method is private; the Dashboard needs access to discard a pending or failed record. After a successful send, the outbox removes the record and the expense service reloads the saved list. These existing mechanisms are the starting point for the implementation plan.

Current implementation references:

- `src/services/outbox/outbox.service.ts`: outbox records, send triggers, error status, and discard.
- `src/modules/dashboard/dashboard/dashboard-page.view-model.ts`: list and summary computed signals.
- `src/modules/dashboard/expenses.service.ts`: list reload after a send.

Next step: user UI review, then archive the task. This task document does not authorize extra features from the idea collection.

**2026-11-05** - implemented via adlc:implement; checks green.

The final harness passes lint, type checking, production build, and 315 tests; two existing
AppComponent tests remain skipped. The user takes ownership of UI checks and asks the agent
to stop them. The implementation plan contains the action log and remaining live-check scope.
One disposable Test expense of 12.34 with comment `Queued offline test 2026-11-05` remains
queued from the partial visual check. The temporary offline simulation is removed.
