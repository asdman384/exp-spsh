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
Years run from the current year to 2019. Month labels use the browser's default locale.
The month carousel scrolls to the current month through Material's private `_elementRef`
and `_tabHeader.scrollDistance` members.
Changing the sheet, year, or month returns to the category summary and resets category selection.

`StatisticsDataService` belongs to the page. It reads one range from the start of the
previous month to the start of the following month, exclusive. It splits the result at
the selected month start. A saved expense dated later in the selected month counts toward that month.
January includes December of the previous year. The Dashboard
expense signal is independent of these reads. Only saved rows enter statistics.

A new selection cancels the previous request and clears its rows. Going offline clears
the rows and waits for a connection. Reconnect reloads the latest selection. The summary header is hidden while data is
unavailable. Failure dispatches the fixed `loadExpenses$` toast. Page destruction cancels subscriptions.

# Aggregation

`summarizeMonth` is a pure function. It groups all rows by category, regardless of `isInDebt`.
Missing or empty category names display as `Uncategorized`. The summary contains the union
of categories in both months, sorted by current amount descending, then category name.
A category present only in the previous month has a current amount of zero. Its name and all
three values appear in gray. A category with current entries keeps the standard colors,
even when its amounts add up to zero.

The page passes category totals and the previous month's tab label to the shared expenses
table. It displays Category, Amount, Share, and `vs` followed by that label.
Names can wrap. The three numeric columns align to the right. Amount
has weight 600. Share uses at most one decimal place and is zero when the month total is zero.
Change is the current amount minus the full previous month's amount. An increase has a plus
sign, a decrease has a minus sign, and a change that rounds to zero displays as `0`.
Amounts and changes use Polish number formatting with at most two decimal places.

# Drill-down and totals

Spending appears above its total. Debt appears beside it and sums all signed,
flagged amounts in the selected month. Initially Spending includes all categories
and the checkbox column is hidden.

A short tap on a row opens the category. A stationary half-second press shows the
checkboxes with every category checked. A vertical scroll leaves the summary open.
Keyboard users enter selection with the **Select categories** button. Focus moves to the
header checkbox. Each category has its own details button and, in selection mode, a checkbox.

The page keeps the unchecked category names and passes the checked rows to the table.
The table reports each checkbox action to the page. Spending sums checked categories.
A partial selection gives the header checkbox an
indeterminate state. Activating it selects all categories. Clearing a fully checked
header sets Spending to zero. Shares and Debt always use the full month.

Details use the shared expenses table. It lists the category's current entries, newest
first, with date, amount, and comment. The detail total includes every entry in that
category. A previous-only category has an empty detail view and a zero total.
Back restores the checked categories and the subtotal. Reloading the same sheet and
month preserves the selection by category name. New categories start checked.

# Animation

The page keeps the straight and reverse View Transitions animations for drill-down and
Back. The page renders the new view inside the transition callback. Later navigation or
a context change invalidates a pending callback. Browsers without View Transitions
switch views immediately.

[^statshtml]: Statistics template
[^stats]: StatisticsContainer
[^data]: StatisticsDataService
[^summary]: summarizeMonth
