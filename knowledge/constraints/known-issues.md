---
type: Constraint
title: Known issues and rough edges
description: Defects and fragilities identified by reading the code, each with its trigger and the file to look at - items 1 and 10 fixed 2026-09-08, the rest unfixed.
tags: [constraints, known-issues, defects, technical-debt]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: AppEffects
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.ts
    title: DashboardPageContainer
  - id: table
    resource: ../../src/shared/components/expenses-table/expenses-table.component.ts
    title: ExpensesTableComponent
---

Everything below was derived by reading the code in this repository and has **not been
reproduced at runtime**. Treat each as a lead, not a verdict.

# Correctness

| # | Issue | Trigger | Where |
|---|---|---|---|
| 1 | ~~**Category reorder rollback never dispatches.**~~ **Fixed 2026-09-08.** The `catchError` builds `AppActions.storeCategories({ categories: this.categoriesBackUp })` but did not pass it to `store.dispatch`; now it does. Bundled into `docs/specs/effect-error-surfacing.md` (D5) because the new failure toast for this effect claims "your categories were put back," which would have been false otherwise. | ~~any failed reorder write~~ (resolved) | `app.effects.ts`, `updateCategoryPosition$`[^effects] |
| 2 | **Delete only sees the newest 100 rows.** `loadLastExpenses(title, 100)`; an older expense is not found, the delete is a silent no-op, but the optimistic UI removal already happened. | deleting an expense older than the 100 most recent | `app.effects.ts`, `deleteExpense$` |
| 3 | **Row deletion is positional.** The array index from a fresh read is used as the sheet row index. A concurrent edit or a manual sort in Google Sheets between read and delete removes the wrong row. | concurrent editing | `deleteExpense$` + `deleteSheetRow` |
| 4 | **gviz row mapping dereferences without guards.** `row.c[0].v` and `row.c[2].v` throw on an empty category or amount cell; the effect swallows the error and the table keeps stale data. | a blank cell in column A or C | `spreadsheet.service.ts`, `loadExpenses`[^svc] |
| 5 | **Serial-number date reversal uses today's timezone offset**, not the offset in effect on the stored date, shifting historical rows across DST boundaries. | reading rows from the other side of a DST change | `getDateFromSerialNumber` |
| 6 | **`LocalStorageService.put` skips falsy values.** `if (value)` means `0`, `''`, `false` are never written — a `categoriesSheetId` of `0` (a valid gid) would not persist. | a spreadsheet whose categories tab is the first sheet | `local-storage.service.ts` |
| 7 | **`ngOnChanges` assumes `dataSource` always changes.** `changes['dataSource'].currentValue` is read unconditionally, so any change pass without that input throws. | binding another input alone | `expenses-table.component.ts`[^table] |
| 8 | **Non-null assertion on the current sheet.** `sheet!.id` in the dashboard constructor throws if no sheet is selected. `isSetupReady` does not check `selectedSheetId`. | entering the dashboard with `dataSheets.selectedSheetId === null` | `dashboard-page.container.ts`[^page] |
| 9 | **Setup has no error handling.** No `catchError` anywhere in `checkSetup`, so any failure hangs the spinner forever. | permissions, network, bad URL | `setup-page.container.ts` |

# Fragility and debt

| # | Issue | Note |
|---|---|---|
| 10 | ~~**All errors are silent.**~~ **Fixed 2026-09-08** for the 7 remote-calling effects — see `docs/specs/effect-error-surfacing.md`. Each now dispatches `operationFailed({ source, message })`, sets `AppState.lastError`, and `showFailureToast$` opens a `MatSnackBar`. **Still true** for the 4 localStorage-only persist effects (item 20) and for `setup-page.container.ts` (item 9, unchanged). | localStorage effects; setup page |
| 11 | **The gviz endpoint is a charting API used as a query API.** Unversioned relative to Sheets; its envelope has changed before (commit `cdc85e6`). | [gviz](/interfaces/gviz-query.md) |
| 12 | **The on-page logger is always on.** `loggerType` is hard-coded to `'window'`; the URL-driven line is commented out. Every user, in production, gets the overlay. | `src/logger.ts` |
| 13 | **Three test suites are `describe.skip`** (`AppComponent`, `LocalStorageService`, `ExpDialogComponent`), and `app.component.spec.ts` still asserts a title the app no longer renders. | [testing](/operations/testing.md) |
| 14 | **CI runs no tests.** A failing suite still deploys. | [CI](/operations/ci-and-deployment.md) |
| 15 | **`ExpDialogComponent` is unreferenced** except through `UIKitModule` imports — the destructive delete gestures have no confirmation. | `src/shared/components/dialog/` |
| 16 | **Dead configuration.** `environment.*.ts` `SCOPES`/discovery docs and the `BACK` UI constant are unused; `SpreadsheetService.append` is `@deprecated` and uncalled. | [configuration](/operations/configuration-and-secrets.md) |
| 17 | **`test.ts` at the repo root** is a scratch iterator experiment referenced by no config. | repo root |
| 18 | **The `.claude/settings copy.json` hook points at a missing script** (`.claude/hooks/guard.mjs`). | [working agreements](/constraints/working-agreements.md) |
| 19 | **Duplicate commit history around `isInDebt`** (`d787877` and `00eda29` share a message), and a revert pair (`98f2b23` / `3075d41`) — the debt feature settled through trial and error. | git history |
| 20 | **The 4 localStorage-only persist effects have no failure path.** `saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$`, `saveCategories$` still have no `catchError` at all — a throwing `LocalStorageService.put` (quota exceeded, Safari private-browsing restrictions) is fully uncaught. Deliberately out of scope for the item-10 fix: a different failure class (synchronous, non-network, non-retryable) with a different remedy than any of the 7 toast strings fit. Follow-up spec named but not written: `storage-write-failures`. | quota exceeded / private browsing storage restrictions | `app.effects.ts`, the 4 `{ dispatch: false }` persist effects |
| 21 | **Every remote effect goes permanently unresponsive after its first failure of the session.** All 7 remote-calling effects' `catchError` sits on the *outer* pipe and returns `EMPTY`, which *completes* that effect's stream; NgRx's default effects error handler resubscribes on an **error** notification, not on a **completion**. Surfaced while implementing item 10's fix — pre-existing and undocumented before that. Its consequence: the new failure toast (item 10) fires once per effect per session, never twice, even if the same operation fails again later — not because the dispatch is broken, but because nothing is listening anymore. Fixing it means moving `catchError` inside each `exhaustMap` projection, which changes operator topology in all 7 effects and interacts with `deleteExpense$`'s rollback — a separate, larger task. Follow-up spec named but not written: `effect-resubscription`. | any second failure of the same effect, same session | `app.effects.ts`, all 7 remote effects |

[^effects]: AppEffects
[^svc]: SpreadsheetService
[^table]: ExpensesTableComponent
[^page]: DashboardPageContainer
