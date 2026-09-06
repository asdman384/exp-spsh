---
type: Interface
title: NgRx action surface
description: The complete `App shell` action group - payloads, who dispatches each action, and what consumes it.
tags: [interface, ngrx, actions, contract]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: actions
    resource: ../../src/@state/app.actions.ts
    title: AppActions action group
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: AppEffects
---

All actions live in one `createActionGroup` with `source: 'App shell'`, so DevTools shows
them as `[App shell] <event>`.[^actions] This is the app's internal contract between
containers and effects.

# General

| Action | Payload | Dispatched by | Consumed by |
|---|---|---|---|
| `loading` | `{ loading: boolean }` | every effect, imperatively | reducer -> toolbar progress bar |
| `setTitle` | `{ title: string; icon?: string }` | each page container's constructor | reducer -> toolbar headline |

Every routed container sets its own title: Dashboard/`dashboard`,
Spending categories/`category`, Month summary/`query_stats`, Settings/`settings`,
Login/`login`.

# Setup

| Action | Payload | Dispatched by | Consumed by |
|---|---|---|---|
| `spreadsheetId` | `{ spreadsheetId: string \| undefined }` | setup after `getSpreadsheet` | reducer + persist effect |
| `upsertDataSheet` | `{ dataSheet: Sheet }` | setup (discovery and creation) | reducer (entity upsert) + persist effect |
| `setCurrentSheet` | `{ sheet: Sheet \| string }` | `AppComponent` on boot, setup after creating the data sheet | reducer only (accepts a title or a whole `Sheet`) |
| `categoriesSheetId` | `{ categoriesSheetId: number \| undefined }` | setup after creating the categories sheet | reducer + persist effect |

# Categories

| Action | Payload | Dispatched by | Consumed by |
|---|---|---|---|
| `loadCategories` | none | categories page ctor, dashboard "Click to Load" | `loadCategories$` |
| `storeCategories` | `{ categories: Category[] }` | the four category effects, setup (clears to `[]`) | reducer + persist effect |
| `addCategory` | `{ newCategory: Category }` | categories page | `addCategory$` |
| `deleteCategory` | `{ category: Category }` | categories page (drag right) | `deleteCategory$` |
| `updateCategoryPosition` | `{ categories: Category[] }` | categories page (reorder) | `updateCategoryPosition$` |

# Expenses

| Action | Payload | Dispatched by | Consumed by |
|---|---|---|---|
| `addExpense` | `{ sheetId: number; expense: Expense }` | dashboard form submit | `addExpense$` |
| `deleteExpense` | `{ sheet: Sheet; expense: Expense }` | dashboard row swipe | `deleteExpense$` |
| `loadExpenses` | `{ sheetId: number; from?: Date; to?: Date }` | dashboard, statistics, `addExpense$` | `loadExpenses$` |
| `storeExpenses` | `{ expenses: Expense[] }` | `loadExpenses$`, `deleteExpense$` | reducer (replaces the array) |

# Conventions

- **Intent versus result.** `load*`/`add*`/`delete*`/`update*` are intents handled only by
  effects; `store*` are results handled only by the reducer. Nothing dispatches a `store*`
  action from a container except setup's deliberate `storeCategories([])` reset.
- **Payload asymmetry.** `addExpense` takes a `sheetId: number` while `deleteExpense` takes
  the whole `Sheet` — delete needs both the gid (for `deleteDimension`) and the title (for
  the `A1:E100` re-read).
- There are **no failure actions**. Errors terminate in `catchError` inside each effect
  ([known issues](/constraints/known-issues.md)).

[^actions]: AppActions action group
