---
type: Architecture Component
title: NgRx state management
description: Shape of the `app` feature slice, which actions are reducer-handled versus effect-only, how it is hydrated, how failures are reported, and the signal services that hold expenses and the outbox outside the store.
tags: [architecture, ngrx, state, effects]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
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
  - id: outbox
    resource: ../../src/services/outbox/outbox.service.ts
    title: OutboxService
  - id: expenses
    resource: ../../src/modules/dashboard/expenses.service.ts
    title: ExpensesService
---

# Store shape

One slice: `app` (spreadsheet, categories, UI chrome).[^model] The expense list and the
[write outbox](write-outbox.md) are **not** in the store; they are signals of
[`ExpensesService`](#expensesservice) and [`OutboxService`](#outboxservice).

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
  lastError: AppError | null;        // { id, source, message }; written by operationFailed, read by no UI
}
```

# Hydration

- `app`'s `initialState` is built synchronously at module load from four
  [localStorage keys](../interfaces/local-storage.md): `spreadsheetId`, `categoriesSheetId`,
  `categories`, `dataSheets`. `lastError` and the selected sheet are not
  persisted; `AppComponent` re-selects `data_<user.name>` at startup.[^reducers]
- `metaReducers` is empty.

# Reducer-handled versus effect-only actions

| Action | Reducer | Effect |
|---|---|---|
| `loading`, `setTitle`, `setCurrentSheet` | yes | — |
| `spreadsheetId`, `categoriesSheetId`, `upsertDataSheet`, `storeCategories` | yes | persisted to localStorage |
| `loadCategories`, `addCategory`, `deleteCategory`, `updateCategoryPosition` | no | remote call, ends in `storeCategories` |
| `operationFailed` | yes (`lastError`) | `showFailureToast$` opens a snackbar |

Intents are effect-only and terminate in a result action the reducer applies
([action surface](../interfaces/ngrx-actions.md)).

# `AppEffects`

| Effect | Operator | Result |
|---|---|---|
| `saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$`, `saveCategories$` | `tap` | write localStorage (`saveSheetId$` re-writes all sheets on every later sheets change) |
| `loadCategories$` | `exhaustMap` | `storeCategories` |
| `addCategory$` | `exhaustMap` | `storeCategories([...current, new])` after the append succeeds |
| `deleteCategory$` | `exhaustMap` | row index by name, `deleteSheetRow`, `storeCategories` |
| `updateCategoryPosition$` | `exhaustMap` | **optimistic** `storeCategories`, then write; rollback from a `Memento` on failure |
| `showFailureToast$` | `tap` | `MatSnackBar.open(message, 'Dismiss', { politeness: 'assertive', verticalPosition: 'top' })`, no `duration` |

`Memento<T>` (`src/shared/helpers`) holds one snapshot; `take()` returns and clears it, so a
rollback consumes it exactly once.

`loading` is set imperatively (`store.dispatch(AppActions.loading(...))` inside the effect),
not emitted as a mapped action. `exhaustMap` drops a second identical intent while the first
is in flight.

# Failure reporting

The 4 remote category effects and `ExpensesService`'s load and delete dispatch
`operationFailed({ source, message })` on failure and clear `loading`:[^reportfailure]

- `loadCategories$`, `addCategory$`, `deleteCategory$`, and `ExpensesService.load` via
  `catchError(reportFailure(source, store))`, which logs `toMessage(e)`, dispatches
  `loading(false)` and `operationFailed`, and returns `EMPTY`;
- `updateCategoryPosition$` and `ExpensesService.delete` inline, alongside their rollback.

`source` is an effect-style name (`'loadExpenses$'`, `'deleteExpense$'` for the service).
`message` is one of 7 fixed strings in `FAILURE_MESSAGES`; the raw error only goes to `log()`.
Other dispatchers:

- `OutboxService`: `source: 'outboxDrain$'` with `OUTBOX_MESSAGES.authBlocked`, and
  `reportFailure('addExpense$')` when an enqueue cannot be persisted;
- `DashboardPageContainer`: `source: 'Gemini'` with the **raw** recognition error as
  `message` ([known issues](../constraints/known-issues.md) #33).

Every remote `catchError` sits on the inner observable inside `exhaustMap`, so a failure ends
only that attempt; later requests are still handled.

The four localStorage effects put `catchError` on the **outer** pipe: a throwing
`localStorage.setItem` is logged with no toast, and that effect's stream completes for the
rest of the session (the reducer still updates in-memory state). See
[known issues](../constraints/known-issues.md) #28.

# `OutboxService`

A root service in `src/services/outbox/` that owns the write queue: boot hydration (from
`provideAppInitializer`), persist-first add, the drain loop, Retry/Discard, the failure
notice, and announcements. It exposes `records`, `pendingCount`, `failedCount`, and `sent$`.
See [the write outbox](write-outbox.md).[^outbox]

# `ExpensesService`

A root service in `src/modules/dashboard/` that owns the expense list outside NgRx.[^expenses]

| Member | Behaviour |
|---|---|
| `expenses` | read-only signal, the currently displayed set |
| `load(filter)` | `switchMap` onto `online$.filter(true)` → `exhaustMap` → `SpreadsheetService.loadExpenses` → `expenses.set` ([load](../flows/load-expenses.md)) |
| `add(sheetId, expense)` | `OutboxService.add`; never calls Google ([add](../flows/add-expense.md)) |
| `delete(sheet, expense)` | `exhaustMap`; **optimistic** removal from the signal, re-read, delete by index, re-insert on failure ([delete](../flows/delete-expense.md)) |

It dispatches `loading` and `operationFailed` to the store, and reloads the last sent
record's day on `OutboxService.sent$` when the route is exactly `/dashboard`. The dashboard and
statistics pages read `expenses` directly (statistics through `toObservable`); the dashboard
also feeds it expenses recognized from [voice notes](../flows/voice-recording.md#recognition).

# Selectors

`app`: `loadingSelector`, `titleSelector`, `spreadsheetIdSelector`, `lastErrorSelector`,
`currentSheetIdSelector`, `sheetsSelector`, `currentSheetSelector` (entity by stored title,
`undefined` when none), `byIdSheetSelector(id)`, `categoriesSheetIdSelector`,
`categoriesSelector`.[^selectors] `lastErrorSelector` and `byIdSheetSelector` have no
consumers.

# DevTools

`StoreDevtoolsModule.instrument(...)` is registered only when the URL carries `?logger=`;
`@ngrx/store-devtools` is dynamically imported, so it is not downloaded otherwise
([dependency wiring](dependency-wiring.md)).

[^model]: AppState / SheetsState interfaces
[^reducers]: Reducers, entity adapter, initial-state hydration
[^reportfailure]: reportFailure and FAILURE_MESSAGES
[^selectors]: Selectors
[^outbox]: OutboxService
[^expenses]: ExpensesService
