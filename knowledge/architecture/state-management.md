---
type: Architecture Component
title: NgRx state management
description: Shape of the `app` and `outbox` feature slices, which actions are reducer-handled versus effect-only, how each slice is hydrated, and how effects report failure.
tags: [architecture, ngrx, state, effects]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: model
    resource: ../../src/@state/app.model.ts
    title: AppState / SheetsState interfaces
  - id: reducers
    resource: ../../src/@state/app.reducers.ts
    title: Reducers, entity adapter, initial-state hydration
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: AppEffects
  - id: reportfailure
    resource: ../../src/@state/report-failure.ts
    title: reportFailure and FAILURE_MESSAGES
  - id: selectors
    resource: ../../src/@state/app.selectors.ts
    title: Selectors
  - id: outboxmodel
    resource: ../../src/@state/outbox.model.ts
    title: OutboxState
  - id: outboxeffects
    resource: ../../src/@state/outbox.effects.ts
    title: OutboxEffects
---

# Store shape

Two slices: `app` (spreadsheet, categories, expenses, UI chrome) and `outbox` (the
[write outbox](write-outbox.md) queue).[^model]

```ts
interface SheetsState extends EntityState<Sheet> {   // keyed by Sheet.title, not Sheet.id
  selectedSheetId: string | null;                    // a title string
}

interface AppState {
  loading: boolean;                  // toolbar progress bar
  title: string; icon?: string;      // toolbar headline, set by each page
  spreadsheetId: string | undefined;
  dataSheets: SheetsState;           // the data_<user> tabs
  categoriesSheetId: number | undefined;
  categories: Array<Category>;
  expenses: Array<Expense>;          // the currently displayed set
  lastError: AppError | null;        // { id, source, message }; written by operationFailed, read by no UI
}
```

`outbox` is `EntityState<OutboxRecord> & { draining: boolean }`, keyed by `localId` and
sorted by `(enqueuedAt, localId)`.[^outboxmodel]

# Hydration

- `app`'s `initialState` is built synchronously at module load from four
  [localStorage keys](../interfaces/local-storage.md): `spreadsheetId`, `categoriesSheetId`,
  `categories`, `dataSheets`. `expenses`, `lastError`, and the selected sheet are not
  persisted; `AppComponent` re-selects `data_<user.name>` at startup.[^reducers]
- `outbox` starts empty. `OutboxEffects.hydrateOnInit$` reads IndexedDB on
  `ROOT_EFFECTS_INIT` and dispatches `hydrated` (`setAll`); every drain pass re-hydrates at
  its start and end.
- `metaReducers` is empty.

# Reducer-handled versus effect-only actions

| Action | Reducer | Effect |
|---|---|---|
| `loading`, `setTitle`, `setCurrentSheet`, `storeExpenses` | yes | — |
| `spreadsheetId`, `categoriesSheetId`, `upsertDataSheet`, `storeCategories` | yes | persisted to localStorage |
| `loadCategories`, `addCategory`, `deleteCategory`, `updateCategoryPosition` | no | remote call, ends in `storeCategories` |
| `addExpense`, `deleteExpense`, `loadExpenses` | no | remote call (or outbox enqueue) |
| `operationFailed` | yes (`lastError`) | `showFailureToast$` opens a snackbar |

Intents are effect-only and terminate in a result action the reducer applies. `OutboxActions`
follow the same split ([action surface](../interfaces/ngrx-actions.md)).

# `AppEffects`

| Effect | Operator | Result |
|---|---|---|
| `saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$`, `saveCategories$` | `tap` | write localStorage (`saveSheetId$` re-writes all sheets on every later sheets change) |
| `loadCategories$` | `exhaustMap` | `storeCategories` |
| `addCategory$` | `exhaustMap` | `storeCategories([...current, new])` after the append succeeds |
| `deleteCategory$` | `exhaustMap` | row index by name, `deleteSheetRow`, `storeCategories` |
| `updateCategoryPosition$` | `exhaustMap` | **optimistic** `storeCategories`, then write; rollback from a `Memento` on failure |
| `addExpense$` | `exhaustMap` | live write → `loadExpenses` for that day, or `OutboxActions.enqueue` ([write outbox](write-outbox.md)) |
| `deleteExpense$` | `exhaustMap` | **optimistic** removal, re-read, delete by index; rollback from a `Memento` on failure |
| `loadExpenses$` | `switchMap(whenOnline)` → `exhaustMap` | `storeExpenses`; waits for connectivity |
| `showFailureToast$` | `tap` | `MatSnackBar.open(message, 'Dismiss', { politeness: 'assertive', verticalPosition: 'top' })`, no `duration` |

`Memento<T>` (`src/shared/helpers`) holds one snapshot; `take()` returns and clears it, so a
rollback consumes it exactly once.

`loading` is set imperatively (`store.dispatch(AppActions.loading(...))` inside the effect),
not emitted as a mapped action. `exhaustMap` drops a second identical intent while the first
is in flight.

# Failure reporting

The 7 remote effects dispatch `operationFailed({ source, message })` on failure and clear
`loading`:[^reportfailure]

- five via `catchError(reportFailure(source, store))`, which logs `toMessage(e)`, dispatches
  `loading(false)` and `operationFailed`, and returns `EMPTY`;
- `updateCategoryPosition$` and `deleteExpense$` inline, alongside their rollback.

`message` is one of 7 fixed strings in `FAILURE_MESSAGES`; the raw error only goes to `log()`.
`OutboxEffects` reuses `operationFailed` with `source: 'outboxDrain$'` for its auth toast, and
`reportFailure('addExpense$')` when an enqueue cannot be persisted.

Every remote effect's `catchError` sits on the inner observable inside `exhaustMap`, so a
failure ends only that attempt; the effect keeps handling later actions.

The four localStorage effects put `catchError` on the **outer** pipe: a throwing
`localStorage.setItem` is logged with no toast, and that effect's stream completes for the
rest of the session (the reducer still updates in-memory state). See
[known issues](../constraints/known-issues.md) #28.

# `OutboxEffects`

A second effects class owning everything after `addExpense$` decides to queue: boot
hydration, persist-first enqueue, the drain loop, Retry/Discard, the failure notice, the
post-drain reload, and announcements. See [the write outbox](write-outbox.md).[^outboxeffects]

# Selectors

`app`: `loadingSelector`, `titleSelector`, `spreadsheetIdSelector`, `lastErrorSelector`,
`currentSheetIdSelector`, `sheetsSelector`, `currentSheetSelector` (entity by stored title,
`undefined` when none), `byIdSheetSelector(id)`, `categoriesSheetIdSelector`,
`categoriesSelector`, `expensesSelector`.[^selectors] `lastErrorSelector`,
`byIdSheetSelector`, and `isDrainingSelector` have no consumers.

`outbox`: `pendingCountSelector` (`status === 'pending'` only), `failedCountSelector`,
`oldestFailedSelector`, `isDrainingSelector`.

# DevTools

`StoreDevtoolsModule.instrument(...)` is registered only when the URL carries `?logger=`;
`@ngrx/store-devtools` is dynamically imported, so it is not downloaded otherwise
([dependency wiring](dependency-wiring.md)).

[^model]: AppState / SheetsState interfaces
[^reducers]: Reducers, entity adapter, initial-state hydration
[^reportfailure]: reportFailure and FAILURE_MESSAGES
[^selectors]: Selectors
[^outboxmodel]: OutboxState
[^outboxeffects]: OutboxEffects
