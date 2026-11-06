---
type: Flow
title: Monthly statistics and drill-down
description: Person/year/month selection, client-side aggregation by category, the drill-down into one category, and the View Transitions animation.
tags: [flow, statistics, aggregation, view-transitions]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: stats
    resource: ../../src/modules/dashboard/statistics/statistics.container.ts
    title: StatisticsContainer
  - id: statshtml
    resource: ../../src/modules/dashboard/statistics/statistics.container.html
    title: Statistics template
  - id: data
    resource: ../../src/modules/dashboard/statistics/statistics-data.service.ts
    title: StatisticsDataService
  - id: summary
    resource: ../../src/modules/dashboard/statistics/statistics-summary.ts
    title: summarizeMonth
---

# Selection and loading

The user, year, and month tabs select a numeric sheet ID and a local calendar month.
Years run from the current year to 2019. The month carousel scrolls to the current month.
A selection change returns to the category summary.

`StatisticsDataService` belongs to the page. It reads one range from the start of the
previous month to the start of the following month, exclusive. It splits the result at
the selected month start. January includes December of the previous year. The Dashboard
expense signal is independent of these reads. Only saved rows enter statistics.

A new selection cancels the previous request and clears its rows. Going offline clears
the rows and waits for a connection. Reconnect reloads the latest selection. The summary header is hidden while data is
unavailable. Failure dispatches the fixed `loadExpenses$` toast. Page destruction cancels subscriptions.

# Aggregation

`summarizeMonth` is a pure function. It groups all rows by category, regardless of `isInDebt`.
Missing or empty category names display as `Uncategorized`. The summary contains the union
of categories in both months, sorted by current amount descending, then category name.
A category present only in the previous month has a current amount of zero.

Spending rows show their percentage of the current spending total, with one decimal at
most. A zero total gives zero shares. Flagged rows enter totals and shares exactly like all other rows.
Spending rows show current minus previous amount, with a sign and direction arrow. No
previous entries means a zero baseline. The comparison is against the full previous
calendar month, including when the selected month is still in progress.

The table displays share and delta below the amount to keep the column count small.
The summary header shows `Debt · amount`, the signed sum of current-month debt.
There is no debt table or debt drill-down. The flag does not affect spending deltas.

# Drill-down and totals

Clicking a category shows all its current-month rows, newest first.
The debt flag does not filter the detail list or change its total. Back restores the category summary. Detail rows contain amount, comment,
and date; they do not show category shares or deltas.

All spending summary rows start selected. The `Spending` figure sums checked
rows. Shares always use the whole spending total, independent of checkbox selection.
In detail mode the total sums all rows of that category.

# Animation

The page keeps the straight and reverse View Transitions animations for drill-down and
back. A new emission cancels an obsolete pending table update. `summaryTable` is an
optional view query because selection can run before the view exists. The month selector
is read after view init.

[^statshtml]: Statistics template
[^stats]: StatisticsContainer
[^data]: StatisticsDataService
[^summary]: summarizeMonth
