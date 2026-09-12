---
type: Flow
title: Monthly statistics and drill-down
description: Person/year/month selection, client-side aggregation by category, the drill-down into one category, and the View Transitions animation.
tags: [flow, statistics, aggregation, view-transitions]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: stats
    resource: ../../src/modules/dashboard/statistics/statistics.container.ts
    title: StatisticsContainer
  - id: statshtml
    resource: ../../src/modules/dashboard/statistics/statistics.container.html
    title: Statistics template
  - id: consts
    resource: ../../src/constants/UI.ts
    title: TOTAL constant
---

# Selection

Three `mat-tab-group` carousels, each a selector rather than a tab panel:[^statshtml]

| Carousel | Items |
|---|---|
| User | one tab per data sheet, labelled `title.split('_')[1]` |
| Year | `currentYear` down to **2019** (`new Date().getFullYear() - 2018` entries) |
| Month | `Jan..Dec`, from `new Date(0, i).toLocaleString('default', { month: 'short' })` |

Any change calls `formChanged(sheetIndex, yearIndex, monthIndex, sheets)`, which resets the
table animation and dispatches [`loadExpenses`](load-expenses.md) for the whole month.
The initial selection takes the current sheet from the store and the current month from the
clock; `ngAfterViewInit` scrolls the month carousel so the current month is visible when it
would otherwise be off-screen (`MONTH_BUTTON_WIDTH = 50`, `PADDINGS = 76`).

# Aggregation

The displayed rows come from an aggregator function held in a `BehaviorSubject`:[^stats]

```
aggregator$ --switchMap--> expensesSelector --map(fn)--> startViewTransition --> table
```

- **Default `groupByCategory`** — group by `category`, sum `amount`, emit one
  `{ category, amount }` per group. Rows have no `date`/`comment`, so the table hides those
  columns automatically.
- **`filterByCategoryName(name)`** — keep only that category, sort newest-first, and project
  to `{ amount, comment, date }`. Dropping `category` is what makes the table swap its
  columns on drill-down.

Both are pure module-level functions; no aggregation happens server-side.

# Drill-down and back

Clicking a **category** cell emits `cellClick`; the handler ignores clicks on other
columns and on the literal `TOTAL` category,[^consts] then sets `selectable = false`,
plays the `straight` animation, records `selectedCategory`, and pushes the filter
aggregator. The undo button calls `unCategory()`, which restores the grouping aggregator and
plays the `reverse` animation.

# Total

The table is rendered with `[selected]="expenses"` (everything preselected) and
`[selectable]="selectable"`. Its `selectionChange` output feeds
`total = sum(Number(amount))` followed by an explicit `cd.detectChanges()`. So the **Total
line reflects the checked rows**, letting the user tick categories off to see a partial sum.
The label shows `selectedCategory ?? 'Total'`.

# Animation

`startViewTransition` wraps each emission in `document.startViewTransition(...)` when the
browser supports it, warning `View transitions unsupported` and updating directly otherwise.
`tableAnimation(direction)` toggles the CSS classes `summary-table-straight` /
`summary-table-reverse` on the table element; the route's `canDeactivate` clears them on
leave ([routing](../architecture/routing-and-guards.md)).

`summaryTable` is an optional `viewChild('summaryTable', { read: ElementRef })` signal, read
with `()?.` because the table sits inside an `@if` and because `tableAnimation` can run before
the view exists — the `sheetsSelector` subscription in the constructor calls `formChanged`,
which calls `tableAnimation('none')`, well before `ngAfterViewInit`. `monthSelector` is a
required `viewChild.required('monthSelector', { read: MatTabGroup })` signal, read only in
`scrollToCurrentMonth()`, which `ngAfterViewInit` calls once the view is guaranteed to exist.

[^statshtml]: Statistics template
[^stats]: StatisticsContainer
[^consts]: TOTAL constant
