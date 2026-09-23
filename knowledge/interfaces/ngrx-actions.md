---
type: Interface
title: NgRx action surface
description: The `App shell` and `Outbox` action groups - payloads, who dispatches each action, and what consumes it.
tags: [interface, ngrx, actions, contract]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: actions
    resource: ../../src/@state/app.actions.ts
    title: AppActions action group
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: AppEffects
  - id: outboxactions
    resource: ../../src/@state/outbox.actions.ts
    title: OutboxActions action group
---

Two `createActionGroup`s: `AppActions` (`source: 'App shell'`) and `OutboxActions`
(`source: 'Outbox'`); DevTools shows `[App shell] <event>` / `[Outbox] <event>`.[^actions]

# `AppActions`

| Action | Payload | Dispatched by | Consumed by |
|---|---|---|---|
| `loading` | `{ loading }` | effects, imperatively | reducer → toolbar progress bar |
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
| `addExpense` | `{ sheetId: number; expense }` | dashboard submit | `addExpense$` |
| `deleteExpense` | `{ sheet: Sheet; expense }` | dashboard swipe | `deleteExpense$` |
| `loadExpenses` | `{ sheetId; from?; to? }` | dashboard, statistics, `addExpense$`, `reloadOnDrainCompleted$` | `loadExpenses$` |
| `storeExpenses` | `{ expenses }` | `loadExpenses$`, `deleteExpense$` | reducer (replaces the array) |
| `operationFailed` | `{ source: string; message: string }` | remote effects on failure; the outbox | reducer (`lastError`) + `showFailureToast$` |

Page titles: Dashboard/`dashboard`, Spending categories/`category`, Month summary/`query_stats`,
Settings/`settings`, Login/`login` (the playground sets its own).

`operationFailed.source` is one of the 7 remote effect names (`'loadCategories$'` …) or
`'outboxDrain$'`; `message` is fixed copy from `FAILURE_MESSAGES` or
`OUTBOX_MESSAGES.authBlocked`, never raw error text
([failure reporting](../architecture/state-management.md#failure-reporting)).

# `OutboxActions`

See [the write outbox](../architecture/write-outbox.md).[^outboxactions]

| Action | Payload | Dispatched by | Consumed by |
|---|---|---|---|
| `hydrated` | `{ records }` | `OutboxEffects` (boot, pass start/end, Retry, Discard) | reducer (`setAll`) |
| `enqueue` | `{ record; drain: boolean }` | `addExpense$` | `persistEnqueue$` |
| `enqueued` | `{ record }` | `persistEnqueue$` after `storage.add` | reducer (`addOne`) |
| `drainRequested` | — | behind-the-queue enqueue, Retry | drain trigger T4 |
| `syncRequested` | — | toolbar outbox button | drain trigger T5; reopens the failure notice |
| `attemptStarted` | `{ localId }` | drain pass, before each send | reducer (`draining: true`) |
| `succeeded` | `{ localId }` | drain pass | reducer (`removeOne`) |
| `retryableFailed` | `{ localId, attempts, lastError }` | drain pass (`retryable`/`auth`) | reducer (stays `pending`) |
| `terminallyFailed` | `{ localId, attempts, lastError, failure }` | drain pass (`terminal` or spreadsheet mismatch) | reducer (`failed`) |
| `drainCompleted` | `{ sent, newlyFailed, remainingPending, lastSent }` | drain pass end | reducer (`draining: false`); reload, announce, failure-notice effects |
| `retry` | `{ localId }` | failure notice | `retry$` |
| `discard` | `{ localId }` | failure notice | `discard$` |

# Conventions

- **Intent vs result.** `load*`/`add*`/`delete*`/`update*`, `enqueue`, `drainRequested`,
  `syncRequested`, `retry`, `discard` are effect-only; `store*` and the other outbox actions
  are reducer results. Only setup dispatches a `store*` from a container
  (`storeCategories([])`).
- **Payload asymmetry.** `addExpense` takes a `sheetId`; `deleteExpense` takes the whole
  `Sheet` because delete needs the gid and the title.
- **One shared failure action**, distinguished by `source`, instead of a failure action per
  intent. The four localStorage persist effects dispatch none.

[^actions]: AppActions action group
[^outboxactions]: OutboxActions action group
