# Knowledge Bundle Update Log

## 2026-09-12 (2)

* **Update**: `scripts/harness.sh` builds production into `tmp/harness-dist` instead of
  `dist/exp-spsh`. Its build shared the dev watcher's output folder, and every harness run
  left a production `index.html` there that the watcher never rewrote, so the local loop
  served a stale bundle until `watch` was restarted. `npm run build` and CI are unchanged
  and still produce `dist/exp-spsh`. Touched: [build and serve](operations/build-and-serve.md),
  [troubleshooting](operations/troubleshooting.md).

## 2026-09-12

* **Update**: `DashboardPageContainer`'s add-expense form migrated from a template-driven
  `ngForm`/`ngModel` form to the experimental Signal Forms API
  (`@angular/forms/signals`: `form()`, `required()`, `[formField]`) — the one form in the app
  that is no longer template-driven. Material controls (`mat-select`, `mat-checkbox`, the
  datepicker input, `matInput`) bind through `[formField]` via their existing
  `ControlValueAccessor`. Touched: [add expense](flows/add-expense.md),
  [code conventions](constraints/code-conventions.md). Bundle-size comparison:
  [docs/signal-forms-migration.md](../docs/signal-forms-migration.md).

## 2026-09-11 (3)

* **Update**: `docs/specs/signal-inputs-outputs.md` — `ExpensesTableComponent`'s five
  `@Input()`s and three `@Output()`s (`EventEmitter`s) became `input()` / `output()` /
  `outputFromObservable()` signals, `ngOnChanges`/`OnChanges`/`SimpleChanges` were removed, and
  `columns` became a `computed()`; `StatisticsContainer`'s two `@ViewChild()`s became
  `viewChild()` (`summaryTable`, optional) and `viewChild.required()` (`monthSelector`).
  Touched: [ExpensesTableComponent](interfaces/expenses-table-component.md),
  [statistics flow](flows/statistics.md), [delete expense flow](flows/delete-expense.md).

## 2026-09-11 (2)

* **Cleanup**: swept the whole bundle (every file except this log) for prose that narrated
  *how something used to behave* — dated phrases like "since 2026-09-08", "fixed 2026-09-08",
  "now all dispatch...", "unchanged", "the old advice still applies", and commit-id citations
  used as history ("has changed before, commit `cdc85e6`") — and rewrote each as a plain
  present-tense statement of current behaviour. Concept files should describe only the
  system as it is now; this log is the only place change history belongs. Touched:
  [dependency wiring](architecture/dependency-wiring.md),
  [state management](architecture/state-management.md),
  [technical constraints](constraints/technical-constraints.md),
  [code conventions](constraints/code-conventions.md),
  [known issues](constraints/known-issues.md), [source map](references/source-map.md),
  [testing](operations/testing.md), [troubleshooting](operations/troubleshooting.md),
  [CI and deployment](operations/ci-and-deployment.md),
  [gviz interface](interfaces/gviz-query.md), [add expense](flows/add-expense.md),
  [delete expense](flows/delete-expense.md), [load expenses](flows/load-expenses.md), and
  [manage categories](flows/manage-categories.md).
* **Correction found during the sweep**: [delete expense](flows/delete-expense.md) step 3
  said a not-found row was "a silent no-op" — actually reading `app.effects.ts` shows
  `deleteExpense$` **throws** `cannot find expense in the last 100 rows` when the row isn't
  in the last 100, which step 5's rollback catches (the optimistic removal is reverted and a
  toast fires). The flow doc and [known issues](constraints/known-issues.md) item 2 now
  match the code.
* **Correction found during the sweep**: [source map](references/source-map.md) said "Ten
  `.spec.ts` files"; twelve currently exist. Corrected the count and named the three
  `src/@state/*.spec.ts` files among "the substantive ones," and added `report-failure.ts`
  to the `@state/` row (both existed but weren't listed).

## 2026-09-11

* **Update**: [dependency wiring](architecture/dependency-wiring.md) — `src/shared/modules/`
  (the `UIKitModule` barrel that re-exported every Material module plus `CommonModule` and
  CDK `DragDropModule`) was deleted. Every standalone component now imports only the
  Material/CDK modules and `@angular/common` pipes/directives its own template uses; the
  `MAT_DATE_LOCALE`/`MAT_DATE_FORMATS` providers moved from the module's `providers` array to
  `DashboardPageContainer`'s own `@Component({ providers: [...] })`, since it is the only
  component with a datepicker. Bundle-size motivated: the barrel put Material's
  datepicker/table/tabs/drag-drop into every component's initial chunk regardless of need.
* **Update**: `getAppConfig()` (`src/app/app.config.ts`) is now `async` and dynamically
  imports `@ngrx/store-devtools` (`await import(...)`) only when the URL carries a `logger`
  query param, instead of statically importing the package at module top-level. `main.ts`
  now awaits `getAppConfig()` before calling `bootstrapApplication`. `StoreDevtools` is a
  genuinely separate lazy chunk now, not just conditionally-instantiated dead weight in the
  initial bundle. Reflected in
  [dependency wiring](architecture/dependency-wiring.md#material-and-cdk-imports),
  [state management](architecture/state-management.md), and
  [technical constraints](constraints/technical-constraints.md).
* **Update**: [exp-spsh system overview](architecture/overview.md) — the app now authors
  zero `@NgModule` classes (previously "the only NgModule is `UIKitModule`").
* **Update**: [code conventions](constraints/code-conventions.md) and
  [ExpensesTableComponent](interfaces/expenses-table-component.md) updated to describe
  per-component Material/CDK imports instead of the `UIKitModule` convention.
* **Update**: [source map](references/source-map.md) — removed the
  `shared/modules/uikit.module.ts` row (path no longer exists).
* Not otherwise touched: `ExpDialogComponent` remains unused dead code, just no longer
  incidentally re-exported through the deleted barrel.

## 2026-09-08

* **Update**: Reflected the `effect-error-surfacing` feature
  (`docs/specs/effect-error-surfacing.md`, `docs/architecture/effect-error-surfacing.md`)
  across the bundle — the 7 remote-calling effects now dispatch `operationFailed` and show a
  `MatSnackBar` toast on failure, instead of failing silently.
* **Update**: [state management](architecture/state-management.md) — new `AppState.lastError`
  field, new `lastErrorSelector`, effects catalogue updated with `showFailureToast$` and the
  `reportFailure` mechanism.
* **Update**: [NgRx action surface](interfaces/ngrx-actions.md) — new `operationFailed`
  action documented; the "no failure actions" claim removed.
* **Update**: [known issues](constraints/known-issues.md) — item 1 (rollback never
  dispatches) and item 10 (all errors silent) marked **fixed**; two issues surfaced during
  the fix added as new entries: item 20 (the 4 localStorage effects still have no failure
  path) and item 21 (every remote effect goes permanently unresponsive after its first
  failure of the session, since `catchError` completes rather than errors).
* **Update**: [troubleshooting](operations/troubleshooting.md),
  [testing](operations/testing.md), and the four affected flows
  ([add expense](flows/add-expense.md), [delete expense](flows/delete-expense.md),
  [load expenses](flows/load-expenses.md), [manage categories](flows/manage-categories.md))
  updated to match — including the new effects-testing pattern (`provideMockActions`, and the
  `log()`-must-exist-before-construction gotcha) now precedented in
  `src/@state/app.effects.spec.ts` and `src/@state/report-failure.spec.ts`.
* Two follow-up specs identified but not written: `storage-write-failures` (known issues
  item 20) and `effect-resubscription` (item 21).

## 2026-09-05

* **Initialization**: Created the OKF v0.2 bundle for exp-spsh from a full read of the
  repository at commit `78b5109` ("update tests docs") on `master`.
* **Creation**: Architecture section — [overview](architecture/overview.md),
  [state management](architecture/state-management.md),
  [routing and guards](architecture/routing-and-guards.md),
  [dependency wiring](architecture/dependency-wiring.md),
  [PWA and service worker](architecture/pwa-and-service-worker.md).
* **Creation**: Domain section — [expense](domain/expense.md),
  [category](domain/category.md), [sheet and user](domain/sheet-and-user.md),
  [spreadsheet layout](domain/spreadsheet-layout.md), [glossary](domain/glossary.md).
* **Creation**: Flows section — eight end-to-end flows covering authentication, setup,
  the expense lifecycle, categories, statistics, and offline behaviour.
* **Creation**: Interfaces section — the three Google boundaries plus the interceptor,
  the NgRx action surface, the shared table contract, and the localStorage keys.
* **Creation**: Systems section — the app artifact, the Google backend, GitHub
  Actions/Pages, and the development toolchain.
* **Creation**: Operations section — build and serve, testing, CI and deployment,
  configuration and secrets, troubleshooting.
* **Creation**: Constraints section — working agreements, technical constraints, security
  posture, code conventions, and [known issues](constraints/known-issues.md) (19 entries
  derived from reading the code, none reproduced at runtime).
* **Creation**: [Source map](references/source-map.md) as the navigation reference.
