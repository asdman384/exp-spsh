---
type: Interface
title: NgRx action surface
description: The `App shell` action group - payloads, who dispatches each action, and what consumes it.
tags: [interface, ngrx, actions, contract]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
sources:
  - id: actions
    resource: ../../src/@state/app.actions.ts
    title: AppActions action group
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: AppEffects
---

One `createActionGroup`: `AppActions` (`source: 'App shell'`); DevTools shows
`[App shell] <event>`.[^actions]

# `AppActions`

| Action | Payload | Dispatched by | Consumed by |
|---|---|---|---|
| `loading` | `{ loading }` | effects, `ExpensesService`, `OutboxService` (via `reportFailure`), `DashboardPageContainer` (voice recognition) | reducer → toolbar progress bar; disables the form buttons and the voice button |
| `setTitle` | `{ title, icon? }` | each page's constructor | reducer → toolbar headline |
| `spreadsheetId` | `{ spreadsheetId: string \| undefined }` | setup, after `getSpreadsheet` | reducer + persist effect |
| `upsertDataSheet` | `{ dataSheet: Sheet }` | setup (discovery, creation) | reducer (entity upsert) + persist effect |
| `setCurrentSheet` | `{ sheet: Sheet \| string }` | `AppComponent` at startup, setup | reducer |
| `categoriesSheetId` | `{ categoriesSheetId: number \| undefined }` | setup | reducer + persist effect |
| `loadCategories` | — | categories page, dashboard "Click to Load" | `loadCategories$` |
| `storeCategories` | `{ categories }` | category effects; setup (`[]`) | reducer + persist effect |
| `addCategory` | `{ newCategory }` | categories page | `addCategory$` |
| `deleteCategory` | `{ category }` | categories page (drag right) | `deleteCategory$` |
| `updateCategoryPosition` | `{ categories }` | categories page (reorder) | `updateCategoryPosition$` |
| `operationFailed` | `{ source: string; message: string }` | remote effects, `ExpensesService`, `OutboxService`, `DashboardPageContainer` | reducer (`lastError`) + `showFailureToast$` |

There are no expense or outbox actions: expenses go through `ExpensesService` and the queue
through `OutboxService` ([state management](../architecture/state-management.md#expensesservice)).

Page titles: Dashboard/`dashboard`, Spending categories/`category`, Month summary/`query_stats`,
Settings/`settings`, Login/`login` (the playground sets its own).

`operationFailed.source` is one of the 7 `FailureSource` names (`'loadCategories$'` …),
`'outboxDrain$'`, or `'Gemini'`. `message` is fixed copy from `FAILURE_MESSAGES` or
`OUTBOX_MESSAGES.authBlocked` — except `'Gemini'`, which passes the raw error
([failure reporting](../architecture/state-management.md#failure-reporting)).

# Conventions

- **Intent vs result.** `loadCategories`/`addCategory`/`deleteCategory`/`updateCategoryPosition`
  are effect-only; `storeCategories` is the reducer result. Only setup dispatches a `store*` from a container
  (`storeCategories([])`).
- **One shared failure action**, distinguished by `source`, instead of a failure action per
  intent. The four localStorage persist effects dispatch none.

[^actions]: AppActions action group
