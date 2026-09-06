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

interface AppState {
  loading: boolean;                 // drives the toolbar progress bar
  title: string;                    // toolbar headline, set per page
  icon?: string;                    // Material icon name for the headline
  spreadsheetId: string | undefined;
  dataSheets: SheetsState;          // the data_<user> tabs
  categoriesSheetId: number | undefined;
  categories: Array<Category>;
  expenses: Array<Expense>;         // the currently displayed set of expenses
}
```

> **Entity-id gotcha:** `createEntityAdapter<Sheet>({ selectId: (e) => e.title })`. The
> adapter keys sheets by **title**, while the Sheets API `sheetId` (a number) lives in
> `Sheet.id`. `selectedSheetId` therefore holds a *title string*, not a numeric id.[^reducers]

# Hydration from localStorage

`initialState` is built synchronously at module load from four
[localStorage keys](/interfaces/local-storage.md): `spreadsheetId`, `categoriesSheetId`,
`categories`, and `dataSheets` (upserted through the adapter). `expenses` is never
persisted; it is always re-fetched.[^reducers]

`metaReducers` is currently an empty array in both dev and prod.

# Reducer-handled versus effect-only actions

| Action | Reducer | Effect |
|---|---|---|
| `loading`, `setTitle` | yes | none |
| `spreadsheetId`, `categoriesSheetId`, `upsertDataSheet` | yes | persists to localStorage |
| `setCurrentSheet` | yes | none (re-derived at startup) |
| `storeCategories`, `storeExpenses` | yes | `storeCategories` persists |
| `loadCategories`, `addCategory`, `deleteCategory`, `updateCategoryPosition` | no | remote call, ends in `storeCategories` |
| `addExpense`, `deleteExpense`, `loadExpenses` | no | remote call, ends in `storeExpenses` |

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

Every effect ends with `catchError` → `log(e)` → clear `loading` → `EMPTY`. **Remote
failures are therefore silent to the user**; the only signal is the on-screen logger
([known issues](/constraints/known-issues.md)).

Loading state is managed imperatively: effects call `dispatch(AppActions.loading(...))`
from inside `tap`/`exhaustMap` rather than emitting it as a mapped action.

All effects use `exhaustMap`, so a second identical intent fired while the first is still
in flight is **dropped, not queued**.

# Selectors

`loadingSelector`, `titleSelector`, `spreadsheetIdSelector`, `currentSheetIdSelector`,
`sheetsSelector`, `currentSheetSelector`, `byIdSheetSelector(id)`,
`categoriesSheetIdSelector`, `categoriesSelector`, `expensesSelector`.[^selectors]

`currentSheetSelector` resolves the entity by the stored title and returns `undefined` when
nothing is selected — several call sites assert it non-null with `!`.

# DevTools

`StoreDevtoolsModule.instrument(...)` is registered **only when the URL carries a `logger`
query parameter**, keeping it out of the normal bundle path. See
[build and serve](/operations/build-and-serve.md).

[^model]: AppState / SheetsState interfaces
[^reducers]: Reducers, entity adapter, initial-state hydration
[^selectors]: Selectors
