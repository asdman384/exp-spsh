# 2026-11-04: Dashboard Running Totals

**Status:** todo
**Priority:**
**Type:** feature
**Module(s):** dashboard
**Owner:** Oleg
**Created:** 2026-11-04

## Description

Add daily, monthly, and monthly Debt totals below the Add Expense button. The user must be able to see spending without opening Statistics.

Source: [Spending-expert review, idea 3](../../../ideas/2026-10-25-spending-expert.md#3-today--this-month-running-total-on-the-dashboard).

Original request (verbatim):

> прочитай идею 3. "Today / This month" running total on the dashboard и придумай и накидай документ для дальнеших шагов\
> В DashboardPageViewModel уже есть his.expensesService.expenses() которые имеют месячный срез - используй это.\
> Здавай вопросы для уточнения

The source idea proposes a daily total and a month-to-date total. The owner replaced its day-count display with a separate Debt figure. It also proposes immediate inclusion of queued expenses from idea 1. The owner selected a first version that counts only loaded expenses. Immediate inclusion of queued expenses and pending table rows remain outside this task.

Use `this.expensesService.expenses()` in `DashboardPageViewModel` for monthly data. The source idea's proposal for a second monthly query and a separate data holder is no longer needed.

## Functional Requirements

- **FR1 — Summary:** Show a compact summary below the Add Expense action row and above the expense table. Use this format: `Today: 47.30 · November: 1240.50 · Debt: 124`. Replace `Today` with `Daily` when the selected date is not today. Use the selected month name alone for the month label. Do not show `so far`, a day count, or thousands separators. Allow the line to wrap on a narrow screen.
- **FR2 — Data source:** Calculate totals in `DashboardPageViewModel` from reactive expense data. Use the existing daily `expenses` computed signal for the daily total and `this.expensesService.expenses()` for the monthly total and its Debt subtotal. Do not add a second monthly request, a second expense store, or a spreadsheet schema change for the summary.
- **FR3 — Period and person:** Use the existing service rows for the selected person, with no request tracking or result identity. Use the selected local calendar day and the interval from that month's first day through the selected day, inclusive. For any date other than today, use `Daily`. The month name and Debt figure both refer to month start through the selected day, even though the labels do not spell out that interval.
- **FR4 — Changes:** Recalculate totals when the source signal changes, including after a successful reload, optimistic deletion, and deletion rollback. Count only loaded expenses. Queued additions, including voice additions, affect totals only after a successful send and reload. Enqueueing, retrying, failing, or discarding an unsent record does not change these totals. Do not count a sent expense twice.
- **FR5 — Amounts:** Show daily and monthly amounts with exactly two decimal places, a decimal point, and no thousands separators. Show Debt with up to two decimal places and no unnecessary trailing zeros (for example, `124`, `124.5`, or `124.50` rendered as `124.5`). Keep signed amounts; do not convert negative adjustments to positive spending. Treat a missing amount as zero, and prevent invalid numeric values from producing `NaN` or `Infinity` in the summary. Do not invent a currency symbol. Include rows marked Debt in the daily and monthly totals, consistent with the current table and Statistics. Also show their signed sum as `Debt`, using the same selected person and monthly interval. Debt is a subtotal of the monthly amount: never subtract it from that amount or add it a second time.

## Non-Functional Requirements

- The summary must remain readable on a narrow mobile screen and at increased text size. Labels and values must be available as text to assistive technology.
- Adding the summary must not add a separate network request on dashboard open or on date/person changes.
- Use local calendar boundaries, consistent with the existing daily filter. Include all times on the selected day.
- Keep ExpensesService and Statistics unchanged.

## Acceptance Criteria

- [x] **FR1:** The summary appears between the action row and table. It wraps without horizontal overflow on a narrow screen. For today, the format is `Today: 47.30 · November: 1240.50 · Debt: 124`; for another selected date, the first label is `Daily`. The month label matches the selection. No day count or thousands separator appears.
- [x] **FR2:** With expenses of 10.00 on November 1 and 12.30 and 5.00 on November 4, selecting November 4 gives a daily total of 17.30 and a month-through-day total of 27.30. No separate monthly query is made for the summary.
- [x] **FR3:** After the existing service loads the selected person, totals use those rows. Date changes recalculate from the current rows. Any date other than today is labeled `Daily`. Entries outside the selected interval are excluded.
- [x] **FR4:** Removing a loaded expense updates the applicable daily and monthly totals, and also Debt if the row is marked Debt. A failed delete restores the totals. A successful add and reload changes the applicable totals exactly once. An unsent manual or voice addition does not change the totals; sending and reloading it includes it exactly once. Failed or discarded unsent records do not change the totals.
- [x] **FR5:** Daily and monthly values use two decimal places; Debt uses up to two without unnecessary trailing zeros. All values use a decimal point and no thousands separator. A negative adjustment reduces the total. A missing or invalid amount does not break the display. A loaded Debt row contributes its signed amount to both applicable totals, just like any other row. If the loaded month contains 100.00 of ordinary expenses and 24.00 of Debt expenses, show a monthly total of `124.00` and `Debt: 24`, not a monthly total of `100.00`. A successful empty result shows `Debt: 0`.

## Common sense considerations

- Use `isInDebt` to identify Debt rows; sum their `amount` values, not a separate debt balance.
- Exclude rows with a missing or invalid date from all three totals.
- Treat missing and non-finite amounts as zero in all three sums; round the final sums for display and show rounded zero without a minus sign.
- Check summary wrapping at a 320 CSS-pixel viewport and with text enlarged to 200%.

## Open Questions

None.

## Notes

**2026-11-04: Owner decisions**

- Totals follow the selected local day and its month through that day.
- Only loaded expenses count. Additions appear in totals after send and reload.
- Debt rows count in the daily and monthly totals. The separate Debt figure is the signed subtotal for the selected monthly interval and is not deducted from the monthly total.
- Display `Today` for today and `Daily` for any other date, followed by the month name and `Debt`. Remove the day count and thousands separators.
- Interpret the requested integer Debt example as a compact amount with up to two decimal places; preserve fractional debt amounts.

**2026-11-04: Current code and planning constraints**

- `src/modules/dashboard/dashboard/dashboard-page.view-model.ts`: the daily `expenses` signal filters the service list by the selected local calendar day. It excludes rows without a date.
- `src/modules/dashboard/expenses.service.ts`: `load()` requests month start through the selected day, using an exclusive upper boundary at the next local midnight. It does not necessarily load the whole calendar month.
- `ExpensesService.add()` only queues the record. The signal updates after the outbox sends the record and the service reloads. There is no immediate local addition to the loaded list.
- `ExpensesService.delete()` removes a loaded row immediately and restores it on failure. Computed totals can follow this behavior directly.
- `ExpensesService` is shared with Statistics. It retains rows across navigation and failed loads. The expense array has no accompanying loaded-person/range/success metadata, and an `Expense` does not contain a person identifier. Filtering by date alone cannot prove that the result belongs to the selected person.
- `OutboxService.sent$` currently reloads the sent record's person and month through its date. This can replace the selected dashboard range. The load pipeline uses `exhaustMap`, so a selection change during a request can also be dropped. This task leaves the existing load and outbox behavior unchanged.
- UI entry points: `dashboard-page.container.html`, `dashboard-page.container.ts`, and `dashboard-page.container.scss` in the same dashboard folder.

Budgets, forecasts, household aggregation, currency conversion, and the general date-entry changes from idea 2 remain outside this task.

**2026-11-05: Owner scope correction**

Remove request/result identity, load status, attempt tokens, request tracking, and delete ownership changes completely. Calculate the summary from the existing expense signal. Keep the service load, outbox refresh, and delete behavior unchanged. Empty data displays zero; this summary does not distinguish initial, retained, offline, or failed-load data.

2026-11-05 — implemented via adlc:implement; checks green. Automated Chromium layout coverage passes; manual visual check is unavailable.
