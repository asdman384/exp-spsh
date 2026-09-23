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
  - id: consts
    resource: ../../src/constants/UI.ts
    title: TOTAL constant
---

# Selection

Three `mat-tab-group`s used as carousels:[^statshtml]

| Carousel | Items |
|---|---|
| User | one tab per data sheet, labelled `title.split('_')[1]` |
| Year | current year down to 2019 |
| Month | `Jan`–`Dec` from `toLocaleString('default', { month: 'short' })` |

Any change calls `formChanged`, which clears the table animation and dispatches
[`loadExpenses`](load-expenses.md) for the whole month. The initial selection is the current
sheet and the current month; `ngAfterViewInit` scrolls the month carousel so the current
month is visible (`MONTH_BUTTON_WIDTH = 50`, `PADDINGS = 76`).[^stats]

# Aggregation

Displayed rows come from an aggregator held in a `BehaviorSubject`:

```
aggregator$ --switchMap--> expensesSelector --map(fn)--> startViewTransition --> table
```

- **`groupByCategory`** (default) — one `{ category, amount }` per category, amounts summed.
  The table hides the other columns because they have no data.
- **`filterByCategoryName(name)`** — that category's rows, newest-first, projected to
  `{ amount, comment, date }`.

All aggregation is client-side.

# Drill-down and back

Clicking a **category** cell (not `TOTAL`, not another column)[^consts] sets
`selectable = false`, plays the `straight` animation, records `selectedCategory`, and pushes
the filter aggregator. The undo button (`unCategory()`) restores grouping and plays `reverse`.

# Total

The table gets `[selected]="expenses"` (all rows pre-selected) and
`[selectable]="selectable"`. `selectionChange` sets `total = sum(Number(amount))` of the
checked rows, so unticking categories shows a partial sum. The label is
`selectedCategory ?? 'Total'`.

# Animation

Each emission runs inside `document.startViewTransition(...)` when supported; otherwise it
updates directly and warns `View transitions unsupported`. `tableAnimation(direction)`
toggles `summary-table-straight` / `summary-table-reverse` on the table element; the route's
`canDeactivate` clears them ([routing](../architecture/routing-and-guards.md)).

`summaryTable` is an optional `viewChild` read with `()?.`, because `formChanged` runs from
the constructor before the view exists. `monthSelector` is `viewChild.required`, read only
after view init.

[^statshtml]: Statistics template
[^stats]: StatisticsContainer
[^consts]: TOTAL constant
