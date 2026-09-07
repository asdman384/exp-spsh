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

# Errors

| Action | Payload | Dispatched by | Consumed by |
|---|---|---|---|
| `operationFailed` | `{ source: string; message: string }` | `reportFailure(source, store)` (5 effects) or inline in the 2 optimistic effects' `catchError`, on any remote-call failure | reducer (`lastError`) + `showFailureToast$` (opens a `MatSnackBar`) |

`source` is always one of the 7 remote effects' own property names (e.g.
`'loadCategories$'`); `message` is always one of 7 fixed, plain-language strings from
`src/@state/report-failure.ts`'s `FAILURE_MESSAGES` table — never the raw error text. See
[state management](/architecture/state-management.md) and
[`docs/specs/effect-error-surfacing.md`](../../docs/specs/effect-error-surfacing.md) in the
repository root.

# Conventions

- **Intent versus result.** `load*`/`add*`/`delete*`/`update*` are intents handled only by
  effects; `store*` are results handled only by the reducer. Nothing dispatches a `store*`
  action from a container except setup's deliberate `storeCategories([])` reset.
- **Payload asymmetry.** `addExpense` takes a `sheetId: number` while `deleteExpense` takes
  the whole `Sheet` — delete needs both the gid (for `deleteDimension`) and the title (for
  the `A1:E100` re-read).
- **Failure is a single shared action, not a pair per intent.** Unlike the `load*`/`store*`
  split, there is no `loadCategoriesFailure`-style action per effect — all 7 remote effects
  funnel into one `operationFailed({ source, message })`, distinguished only by `source`. The
  4 localStorage-only persist effects (`saveSpreadsheetId$` and siblings) still have **no**
  failure path at all — `LocalStorageService.put` throwing is still fully uncaught
  ([known issues](/constraints/known-issues.md) item 20).

[^actions]: AppActions action group
