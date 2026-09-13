---
type: Architecture Component
title: NgRx state management
description: Shape of the `app` and `outbox` feature slices, which actions are reducer-handled versus effect-only, and how each slice is hydrated (localStorage for `app`, IndexedDB for `outbox`).
tags: [architecture, ngrx, state, effects]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
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

Two feature slices are registered through `StoreModule.forRoot`: `app` (spreadsheet, categories,
expenses, and UI chrome) and `outbox` (the [write outbox](write-outbox.md)'s queue).[^model]

```ts
interface SheetsState extends EntityState<Sheet> {   // ids are Sheet.title, not Sheet.id
  selectedSheetId: string | null;
}

interface AppError {
  id: number;      // (state.lastError?.id ?? 0) + 1 -- pure, so consecutive identical
                    // failures still produce distinct objects
  source: string;   // the effect property name that failed, e.g. 'loadCategories$'
  message: string;  // fixed, user-facing copy -- never the raw error
}

interface AppState {
  loading: boolean;                 // drives the toolbar progress bar
  title: string;                    // toolbar headline, set per page
  icon?: string;                    // Material icon name for the headline
  spreadsheetId: string | undefined;
  dataSheets: SheetsState;          // the data_<user> tabs
  categoriesSheetId: number | undefined;
  categories: Array<Category>;
  expenses: Array<Expense>;         // the currently displayed set of expenses
  lastError: AppError | null;       // written by operationFailed, never read back by any
                                     // UI -- a debugging record, not a display source
}
```

> **Entity-id gotcha:** `createEntityAdapter<Sheet>({ selectId: (e) => e.title })`. The
> adapter keys sheets by **title**, while the Sheets API `sheetId` (a number) lives in
> `Sheet.id`. `selectedSheetId` therefore holds a *title string*, not a numeric id.[^reducers]

`outbox`'s shape is `EntityState<OutboxRecord> & { draining: boolean }`, keyed by
`OutboxRecord.localId`, with a `sortComparer` on `(enqueuedAt, localId)` so the collection always
comes out in send order.[^outboxmodel] See [`OutboxRecord`](write-outbox.md) for the record
shape.

# Hydration: localStorage for `app`, IndexedDB for `outbox`

`app`'s `initialState` is built synchronously at module load from four
[localStorage keys](../interfaces/local-storage.md): `spreadsheetId`, `categoriesSheetId`,
`categories`, and `dataSheets` (upserted through the adapter). `expenses` is never
persisted; it is always re-fetched.[^reducers]

`metaReducers` is an empty array in both dev and prod. `lastError` is an `AppState` field
set only by the `operationFailed` reducer branch; it is **never** hydrated from or written
to `LocalStorageService`, and is deliberately kept outside the four localStorage-backed keys
below — it exists purely as a debugging record, not a display source.

`outbox`'s `outboxInitialState` is always an empty, literal collection (`draining: false`) —
nothing synchronous backs it. Real content arrives only via `OutboxEffects.hydrateOnInit$`,
which reads all of IndexedDB once on `ROOT_EFFECTS_INIT` and dispatches
`OutboxActions.hydrated({ records })` (`setAll`, replacing the whole collection). A drain pass
re-dispatches `hydrated` at its start and its end too, so a tab's badge picks up records another
tab sent or removed. See [the write outbox](write-outbox.md).

# Reducer-handled versus effect-only actions

| Action | Reducer | Effect |
|---|---|---|
| `loading`, `setTitle` | yes | none |
| `spreadsheetId`, `categoriesSheetId`, `upsertDataSheet` | yes | persists to localStorage |
| `setCurrentSheet` | yes | none (re-derived at startup) |
| `storeCategories`, `storeExpenses` | yes | `storeCategories` persists |
| `loadCategories`, `addCategory`, `deleteCategory`, `updateCategoryPosition` | no | remote call, ends in `storeCategories` |
| `addExpense`, `deleteExpense`, `loadExpenses` | no | remote call, ends in `storeExpenses` (or routes into the outbox, see below) |
| `operationFailed` | yes (`lastError`) | consumed by `showFailureToast$` (opens a snackbar) |

The pattern is consistent: **intent actions are effect-only and terminate in a `store*`
action** that the reducer applies. `setCurrentSheet` is the one selection action with no
persistence effect — the current sheet is re-derived on startup from the logged-in user's
name (`data_<user.name>`) inside `AppComponent`.

`OutboxActions` (`src/@state/outbox.actions.ts`, `source: 'Outbox'`) follows the same split:
`enqueue`, `drainRequested`, `syncRequested`, `retry`, and `discard` are effect-only intents that
leave `outbox` state unchanged; `hydrated`, `enqueued`, `attemptStarted`, `succeeded`,
`retryableFailed`, `terminallyFailed`, and `drainCompleted` are the results the reducer applies.
See [NgRx action surface](../interfaces/ngrx-actions.md) and
[the write outbox](write-outbox.md).

# Effects catalogue

| Effect | Dispatches | Notes |
|---|---|---|
| `saveSpreadsheetId$` | — | writes `spreadsheetId` to localStorage |
| `saveSheetId$` | — | re-selects all sheets, writes `dataSheets` |
| `saveCategoriesSheetId$` | — | writes `categoriesSheetId` |
| `saveCategories$` | — | writes `categories` |
| `loadCategories$` | `storeCategories` | `exhaustMap` over `getAllCategories()` |
| `addCategory$` | `storeCategories` | appends to the existing array after the write succeeds |
| `deleteCategory$` | `storeCategories` | finds the row index by name, then `deleteSheetRow` |
| `updateCategoryPosition$` | `loading(false)` | **optimistic**: stores the new order before the write |
| `addExpense$` | `loadExpenses`, or `OutboxActions.enqueue` | live write when usable and not behind the queue; otherwise routes into the outbox — see below |
| `deleteExpense$` | `loading(false)` or `storeExpenses` | **optimistic** with rollback |
| `loadExpenses$` | `storeExpenses` | gated on `NetworkStatusService.online$` |
| `showFailureToast$` | — | `{ dispatch: false }`; `ofType(operationFailed)` → `MatSnackBar.open(message, 'Dismiss', { politeness: 'assertive', verticalPosition: 'top' })`, no `duration` (WCAG 2.2.1) |

`OutboxEffects` (`src/@state/outbox.effects.ts`) is a second `@Injectable()` effects class,
registered alongside `AppEffects` in `EffectsModule.forRoot([AppEffects, OutboxEffects])`. It
owns everything the outbox needs once `addExpense$` has decided to queue: boot hydration
(`hydrateOnInit$`), the persist-first enqueue (`persistEnqueue$`), the drain loop and its five
triggers (`drainOnTrigger$`), the Retry/Discard reactions (`retry$`, `discard$`), the failure
notice (`failureNoticeOnDrainCompleted$`, `failureNoticeOnSyncRequested$`), the post-drain
reload (`reloadOnDrainCompleted$`), and the "all sent" announcement (`announceAllSent$`). See
[the write outbox](write-outbox.md) for the full design.[^outboxeffects]

The 7 remote-calling effects (`loadCategories$`, `addCategory$`, `deleteCategory$`,
`updateCategoryPosition$`, `addExpense$`, `deleteExpense$`, `loadExpenses$`) all dispatch
`operationFailed({ source, message })` on failure, in addition to logging and clearing
`loading` — 5 of them via the shared `reportFailure(source, store)` helper in
`src/@state/report-failure.ts` (wraps `catchError`, dispatching `operationFailed` before
returning `EMPTY`), the 2 optimistic ones (`updateCategoryPosition$`, `deleteExpense$`)
inline, alongside their bespoke rollback logic. `message` is always one of 7 fixed,
plain-language strings (`report-failure.ts`'s `FAILURE_MESSAGES` table) — the raw error (via
`toMessage(e)` in `src/shared/helpers/index.ts`) goes only into the `log()` line, never into
the toast or `lastError`. **A failed remote operation surfaces to the user as a snackbar**;
see [`docs/specs/effect-error-surfacing.md`](../../docs/specs/effect-error-surfacing.md) and
[`docs/architecture/effect-error-surfacing.md`](../../docs/architecture/effect-error-surfacing.md)
in the repository root for the full design.

The 7 remote-calling effects each put `catchError` on the *inner* observable built inside
`exhaustMap`'s projection (`app.effects.ts:109` for `loadCategories$`, `:223` for `addExpense$`'s
live branch), not on the outer `actions$` pipe. Returning `EMPTY` from that `catchError`
completes only the inner observable for that one attempt; `exhaustMap` itself is unaffected and
is ready to project the next matching action into a fresh inner observable. So a remote effect
keeps responding to its trigger action after a failure — each subsequent
`addCategory`/`addExpense`/etc. still calls through, still can succeed or fail independently,
and still shows its own toast on failure.

The 4 localStorage-only persist effects (`saveSpreadsheetId$`, `saveSheetId$`,
`saveCategoriesSheetId$`, `saveCategories$`) put `catchError` on the *outer* pipe instead
(`app.effects.ts:46`, `:61`, `:78`, `:92`): each just logs and returns `EMPTY`, with no toast and
no `operationFailed` dispatch, so a `LocalStorageService.put` failure (e.g. quota exceeded) is
fully silent to the user. Because the `catchError` sits on the outer pipe rather than inside an
`exhaustMap` projection, a thrown error completes that effect's stream for the rest of the app's
lifetime; there is no `exhaustMap` re-arming it for a later action of the same type.
`defaultEffectsErrorHandler` (`@ngrx/effects`'s `EFFECTS_ERROR_HANDLER` default) wraps each
effect's stream in its own `catchError` and resubscribes, up to 10 times, only when that stream
emits an *error* notification. These four effects catch their own error and return `EMPTY`, so
their stream emits a *complete* notification, which `defaultEffectsErrorHandler` never
resubscribes. After the first caught throw, that effect's stream stays completed for the rest of
the session: later dispatches of its trigger action (`spreadsheetId`, `upsertDataSheet`,
`categoriesSheetId`, `storeCategories`) still update the store through the reducer, because the
reducer runs independently of the effect, but the effect itself never runs again to write that
value to localStorage.

Loading state is managed imperatively: effects call `dispatch(AppActions.loading(...))`
from inside `tap`/`exhaustMap` rather than emitting it as a mapped action.

All effects use `exhaustMap`, so a second identical intent fired while the first is still
in flight is **dropped, not queued**.

# Selectors

`loadingSelector`, `titleSelector`, `spreadsheetIdSelector`, `currentSheetIdSelector`,
`sheetsSelector`, `currentSheetSelector`, `byIdSheetSelector(id)`,
`categoriesSheetIdSelector`, `categoriesSelector`, `expensesSelector`,
`lastErrorSelector`.[^selectors] `lastErrorSelector` is a flat
`createSelector(selectAppFeature, (state) => state.lastError)`; nothing in the UI currently
subscribes to it — `showFailureToast$` listens to the `operationFailed` action stream
directly, not to this selector, so identical consecutive failures each still open a
snackbar (the action stream is not deduplicated the way a selector would be).

`currentSheetSelector` resolves the entity by the stored title and returns `undefined` when
nothing is selected — several call sites assert it non-null with `!`.

`src/@state/outbox.selectors.ts` adds `pendingCountSelector` (counts `status === 'pending'`
only — a `failed` record never counts as pending and never blocks a live add),
`failedCountSelector`, `oldestFailedSelector` (the earliest `failed` record by the adapter's
`(enqueuedAt, localId)` order, or `undefined`), and `isDrainingSelector`, all built on
`createFeatureSelector<OutboxState>('outbox')`.

# DevTools

`StoreDevtoolsModule.instrument(...)` is registered **only when the URL carries a `logger`
query parameter**. The `@ngrx/store-devtools` package itself is now dynamically imported
(`await import('@ngrx/store-devtools')` inside `getAppConfig()`) rather than statically
imported at the top of `app.config.ts`, so it ships as its own lazy chunk and is fetched
over the network only when the flag is present, instead of sitting parsed-but-unused in the
initial bundle. See [dependency wiring](dependency-wiring.md) and
[build and serve](../operations/build-and-serve.md).

[^model]: AppState / SheetsState interfaces
[^reducers]: Reducers, entity adapter, initial-state hydration
[^selectors]: Selectors
[^outboxmodel]: OutboxState
[^outboxeffects]: OutboxEffects
