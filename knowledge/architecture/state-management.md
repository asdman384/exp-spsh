---
type: Architecture Component
title: NgRx state management
description: Shape of the single `app` feature slice, which actions are reducer-handled versus effect-only, and how state is hydrated from localStorage.
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
---

# Store shape

There is exactly one feature slice, registered as `app` through `StoreModule.forRoot`.[^model]

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

# Hydration from localStorage

`initialState` is built synchronously at module load from four
[localStorage keys](../interfaces/local-storage.md): `spreadsheetId`, `categoriesSheetId`,
`categories`, and `dataSheets` (upserted through the adapter). `expenses` is never
persisted; it is always re-fetched.[^reducers]

`metaReducers` is currently an empty array in both dev and prod. `lastError` is a new
`AppState` field: it is set only by the `operationFailed` reducer branch, is **never**
hydrated from or written to `LocalStorageService`, and is deliberately kept outside the four
localStorage-backed keys below — it exists purely as a debugging record, not a display source.

# Reducer-handled versus effect-only actions

| Action | Reducer | Effect |
|---|---|---|
| `loading`, `setTitle` | yes | none |
| `spreadsheetId`, `categoriesSheetId`, `upsertDataSheet` | yes | persists to localStorage |
| `setCurrentSheet` | yes | none (re-derived at startup) |
| `storeCategories`, `storeExpenses` | yes | `storeCategories` persists |
| `loadCategories`, `addCategory`, `deleteCategory`, `updateCategoryPosition` | no | remote call, ends in `storeCategories` |
| `addExpense`, `deleteExpense`, `loadExpenses` | no | remote call, ends in `storeExpenses` |
| `operationFailed` | yes (`lastError`) | consumed by `showFailureToast$` (opens a snackbar) |

The pattern is consistent: **intent actions are effect-only and terminate in a `store*`
action** that the reducer applies. `setCurrentSheet` is the one selection action with no
persistence effect — the current sheet is re-derived on startup from the logged-in user's
name (`data_<user.name>`) inside `AppComponent`.

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
| `addExpense$` | `loadExpenses` | re-reads that single day after a successful write |
| `deleteExpense$` | `loading(false)` or `storeExpenses` | **optimistic** with rollback |
| `loadExpenses$` | `storeExpenses` | gated on `NetworkStatusService.online$` |
| `showFailureToast$` | — | `{ dispatch: false }`; `ofType(operationFailed)` → `MatSnackBar.open(message, 'Dismiss', { politeness: 'assertive', verticalPosition: 'top' })`, no `duration` (WCAG 2.2.1) |

The 7 remote-calling effects (`loadCategories$`, `addCategory$`, `deleteCategory$`,
`updateCategoryPosition$`, `addExpense$`, `deleteExpense$`, `loadExpenses$`) now all
dispatch `operationFailed({ source, message })` on failure, in addition to logging and
clearing `loading` — 5 of them via the shared `reportFailure(source, store)` helper in
`src/@state/report-failure.ts` (a plain `catchError` replacement), the 2 optimistic ones
(`updateCategoryPosition$`, `deleteExpense$`) inline, alongside their bespoke rollback logic.
`message` is always one of 7 fixed, plain-language strings (`report-failure.ts`'s
`FAILURE_MESSAGES` table) — the raw error (via `toMessage(e)` in
`src/shared/helpers/index.ts`) goes only into the `log()` line, never into the toast or
`lastError`. **A failed remote operation now surfaces to the user as a snackbar**, not just a
stopped spinner; see [`docs/specs/effect-error-surfacing.md`](../../docs/specs/effect-error-surfacing.md)
and [`docs/architecture/effect-error-surfacing.md`](../../docs/architecture/effect-error-surfacing.md)
in the repository root for the full design.

The 4 localStorage-only persist effects (`saveSpreadsheetId$`, `saveSheetId$`,
`saveCategoriesSheetId$`, `saveCategories$`) are **unchanged** — no `catchError`, still
fully silent on a `LocalStorageService.put` failure (e.g. quota exceeded). This is a
deliberate, still-open gap (a different failure class — synchronous, non-network); see
[known issues](../constraints/known-issues.md) item 20.

**Caveat:** every effect's `catchError` still sits on the *outer* pipe and returns `EMPTY`,
which *completes* that effect's stream. NgRx's default effects error handler resubscribes on
an **error** notification, not on a **completion**, so each of the 7 remote effects still
goes permanently unresponsive to its trigger action after its first failure of the session —
the toast now fires for that first failure, but a second failure of the same effect produces
no toast at all (not because dispatch is broken, but because the effect is no longer
listening). See [known issues](../constraints/known-issues.md) item 21.

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

# DevTools

`StoreDevtoolsModule.instrument(...)` is registered **only when the URL carries a `logger`
query parameter**, keeping it out of the normal bundle path. See
[build and serve](../operations/build-and-serve.md).

[^model]: AppState / SheetsState interfaces
[^reducers]: Reducers, entity adapter, initial-state hydration
[^selectors]: Selectors
