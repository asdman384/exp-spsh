# Knowledge Bundle Update Log

## 2026-09-15

Upgraded the project from Angular 21 to Angular 22 via `ng update`, continuing the
19 -> 20 -> 21 chain already noted in [toolchain](systems/toolchain.md).

* **Update**: `ng update @angular/cli @angular/core angular-eslint`, then
  `ng update @angular/material`, then `ng update @ngrx/store @ngrx/effects @ngrx/entity
  @ngrx/store-devtools`, each committed separately (`ng update` requires a clean tree).
  TypeScript moved to `6.0.3` (Angular 22's compiler-cli requires `>=6.0 <6.1`).
* **Update**: raised the active Node.js version to `22.23.2` (via the existing `nvm4w`
  install) — Angular CLI 22 requires Node.js `>= 22.22.3` / `>= 24.15.0` / `>= 26.0.0` and
  the repo's prior `22.12.0` no longer qualifies.
* **Update**: the core migration added `withXhr()` to both `provideHttpClient()` call sites
  (`src/app/app.config.ts`, one spec) since `HttpXhrBackend` (used for upload progress) is no
  longer implied by default; wrapped one template optional-chaining expression in
  `$safeNavigationMigration()` (`src/modules/setup/setup-page/setup-page.container.html`) now
  that the compiler's optional-chaining diagnostics are stricter; and pinned
  `ChangeDetectionStrategy` on ten components that had never set it explicitly, since
  Angular 22 changed the implicit default from the old check-always strategy to `OnPush`.
  The migration chose `Eager` (preserving each component's exact pre-upgrade behavior) on
  all ten; manually switched all ten to `OnPush` instead, matching this project's own
  component convention — every one of them only mutates template-bound state through the
  async pipe or a template event handler, so the switch is behavior-preserving.
* **Update**: `tsconfig.json` gained `"ignoreDeprecations": "6.0"` to silence TS5101
  (`baseUrl` deprecated as of TypeScript 6.0) — `baseUrl` itself stays, since the project's
  dominant absolute-from-root import style (`src/shared/models`, no `paths` map) depends on
  it; `tsconfig.app.json`/`tsconfig.spec.json` gained
  `extendedDiagnostics.checks: { nullishCoalescingNotNullable: suppress,
  optionalChainNotNullable: suppress }` from the same migration, avoiding a wave of new
  template diagnostics unrelated to this upgrade.
* **Update**: [toolchain](systems/toolchain.md), [overview](architecture/overview.md),
  [knowledge index](index.md), `CLAUDE.md`, and
  `.claude/rules/development.md` — version numbers and the `ng update` history line.
* Not touched: `.claude/agents/*.md` and `.claude/commands/orchestrate.md` still say
  "Angular 21" — `CLAUDE.md`'s own "Subagents" section already flags those files as
  describing a nonexistent backend/frontend layout that needs verifying before use, so their
  version mentions were left alone rather than partially patched.

## 2026-09-13 (3)

Offline launch fix: the generated `ngsw.json` listed no asset URLs, so the service worker
cached nothing and opening the app offline failed with `ERR_INTERNET_DISCONNECTED`.

* **Update**: `ngsw-config.json` asset globs are relative to the build output again
  (`/*.js`, `/assets/**`, …); the `/exp-spsh/` prefix matched no output file.
* **Update**: `angular.json` `baseHref` is `/exp-spsh/` (was `""`), so the generator emits
  `/exp-spsh/…` URLs that match what the page requests under the worker's scope.
* **Update**: [PWA](architecture/pwa-and-service-worker.md), [technical
  constraints](constraints/technical-constraints.md), [GitHub Pages](systems/github-pages.md),
  [exp-spsh app](systems/exp-spsh-app.md), [overview](architecture/overview.md),
  [configuration](operations/configuration-and-secrets.md), [build and
  serve](operations/build-and-serve.md) — describe `baseHref` as the carrier of the deployment
  path and the globs as build-output-relative.
* **Correction**: [offline behaviour](flows/offline-and-updates.md) — claimed the app shell was
  prefetched; it was not before this fix.
* **New**: [troubleshooting](operations/troubleshooting.md) row for an offline launch failing
  because `ngsw.json` caches nothing.

## 2026-09-13 (2)

Fix iteration 2 for [write outbox for addExpense](architecture/write-outbox.md), addressing
`docs/reviews/write-outbox.md`'s "Re-review 1" blocking findings 1 and 2:

* **Update**: `src/services/outbox/indexed-db-outbox-storage.service.ts` — every throw while
  creating a transaction (for example `db.transaction(...)` raising `InvalidStateError` on a
  connection the browser has already closed) now reaches the same once-only error channel as the
  existing `abort`/`error` handling, instead of rejecting an unobserved promise and leaving the
  Observable pending forever. `IDBDatabase.onclose` also drops the cached connection, guarded so
  a newer connection already open by the time it fires is never discarded, the same guard used
  for the existing `onversionchange` handling.
* **Update**: [write outbox](architecture/write-outbox.md) — the connection-handling paragraph
  now covers the `close` event dropping the cached connection and a synchronous transaction-setup
  throw reaching the caller as an error, matching the fix above.
* **Correction**: [state management](architecture/state-management.md) — the claim that NgRx's
  default effects error handler "limits" the exposure of the 4 localStorage-only persist effects'
  outer-pipe `catchError` was wrong: that handler resubscribes only on an *error* notification,
  and these effects catch their own error and return `EMPTY`, so their stream emits *complete*
  and is never resubscribed. Restated: after the first caught throw, the effect's stream stays
  completed for the rest of the session, and later dispatches of its trigger action still update
  the store through the reducer but are not written to localStorage.
* **Correction**: [troubleshooting](operations/troubleshooting.md) — the matching row repeated
  the same resubscription claim and described the symptom as "no visible effect", when the
  reducer keeps applying the action in-session; only the localStorage write stops, which becomes
  visible after a reload. Restated accordingly.
* **Correction**: [state management](architecture/state-management.md) — the trigger action of
  `saveSheetId$` is `upsertDataSheet`; there is no `sheetId` action.
* **Correction**: [troubleshooting](operations/troubleshooting.md) — after a reload the value
  reverts to the last one successfully written to localStorage, and is absent only if none was.

## 2026-09-13

Fix iteration 1 for [write outbox for addExpense](architecture/write-outbox.md), addressing
`docs/reviews/write-outbox.md`'s five blocking findings (R-1 to R-5) plus its recommended note
N6:

* **Update**: [write outbox](architecture/write-outbox.md) — the record-shape and enqueue
  descriptions now match `IndexedDbOutboxStorage` settling on transaction commit rather than
  request success (R-2), and three narration phrases are restated as plain present-tense
  descriptions (R-4).
* **Update**: [state management](architecture/state-management.md) — the `catchError`-placement
  claim is scoped to the 7 remote-calling effects; the 4 localStorage-only persist effects are
  described accurately as putting `catchError` on the *outer* pipe (so a throw completes their
  stream), with current line numbers (R-5). Two narration phrases are restated (R-4).
* **Update**: [bootstrap and dependency wiring](architecture/dependency-wiring.md) — one
  narration phrase restated (R-4).
* **Update**: [add expense](flows/add-expense.md), [offline behaviour and app
  updates](flows/offline-and-updates.md), [testing](operations/testing.md) — narration phrases
  restated as present-tense descriptions (R-4).
* **Correction (N6)**: [delete expense](flows/delete-expense.md), [load
  expenses](flows/load-expenses.md), and [manage categories](flows/manage-categories.md) each
  cited known-issue item 21, which does not exist. Verified against the current
  `deleteExpense$`/`loadExpenses$`/`updateCategoryPosition$` source: each effect's `catchError`
  sits inside its `exhaustMap` projection, so a failure only completes that one attempt, and the
  effect keeps responding to later actions of the same type. Restated accordingly.
* **Correction (N6)**: [troubleshooting](operations/troubleshooting.md) — the "retrying an
  already-failed action does nothing" row and the closing "items 1, 10, 20, 21" citation both
  cited known-issues entries that don't exist. The row now describes the one place this pattern
  actually holds (the 4 localStorage-only persist effects, outer-pipe `catchError`); the closing
  citation is replaced with a plain statement, since no matching known-issues entries exist.

Production code changes made alongside this docs pass (R-1, R-2, R-3), reviewed at
`docs/reviews/write-outbox.md`:

* `src/@state/app.effects.ts` — `addExpense$`'s reactive enqueue now captures
  `spreadsheetId`/`enqueuedAt` before the live request goes out, not inside its `catchError`.
* `src/services/outbox/indexed-db-outbox-storage.service.ts` — `add`/`updateStatus`/`remove`/
  `getAll` settle only on their transaction's `complete` event; an `abort` or `error` (including
  after the request itself succeeded) now reaches the Observable's error channel.
* `src/shared/components/outbox-status/outbox-status.component.ts` — the toolbar icon button no
  longer sets `color="primary"` inside the primary toolbar, fixing a 1:1 icon/background
  contrast.

## 2026-09-12 (3)

* **Creation**: [Write outbox for addExpense](architecture/write-outbox.md) — a new NgRx
  `outbox` slice plus `OutboxEffects`, `OutboxStorage`/`IndexedDbOutboxStorage` (raw
  IndexedDB, database `exp-spsh-outbox`), `OutboxDrainLock` (Web Locks), and two new UI
  components (`OutboxStatusComponent`, `OutboxFailureNoticeComponent`) queue and replay
  `addExpense` while offline or on a connectivity failure, drained serially the next time the
  app can reach Google. Every other mutation is unchanged and still fails exactly as before.
  Spec: [`docs/specs/write-outbox.md`](../docs/specs/write-outbox.md). Architecture note:
  [`docs/architecture/write-outbox.md`](../docs/architecture/write-outbox.md).
* **Update**: [state management](architecture/state-management.md) — documents the second
  `outbox` feature slice, `OutboxState`'s shape, `OutboxEffects` in the effects catalogue, the
  outbox reducer/effect and selector tables, and IndexedDB (rather than localStorage)
  hydration for that slice.
* **Correction found while updating state management**: the "effect goes permanently
  unresponsive after its first failure of the session" caveat was wrong — every effect's
  `catchError` sits *inside* `exhaustMap`'s projection, so it only completes that one attempt's
  inner observable; `exhaustMap` itself keeps responding to later actions. Corrected in
  [state management](architecture/state-management.md) and
  [add expense](flows/add-expense.md). The same now-stale claim (citing the removed known-issue
  item 21) still appears in [delete expense](flows/delete-expense.md),
  [load expenses](flows/load-expenses.md), [manage categories](flows/manage-categories.md), and
  [troubleshooting](operations/troubleshooting.md) — noted here, not fixed, since none of those
  are part of this slice's touched-files list.
* **Update**: [offline behaviour and app updates](flows/offline-and-updates.md) — the
  capability table's "Add / delete an expense" row splits into "Add" (now **queued**) and
  "Delete" (still fails as before); the "reads queue, writes do not" line is replaced; a new
  section documents the toolbar outbox indicator.
* **Update**: [NgRx action surface](interfaces/ngrx-actions.md) — documents the `Outbox`
  action group (12 events) and its intent/result split.
* **Update**: [bootstrap and dependency wiring](architecture/dependency-wiring.md) —
  `EffectsModule.forRoot([AppEffects, OutboxEffects])`, and `OutboxStorage`'s root default
  binding (on the abstract class itself, not in `app.config.ts`).
* **Update**: [testing](operations/testing.md) — the ten new spec files this slice adds (all
  new files, per D17 of the spec, so none of the twelve pre-existing specs are touched), and
  the two that exercise real IndexedDB / real Web Locks in headless Chromium rather than a
  double.
* **Update**: [source map](references/source-map.md) — new rows for `services/outbox/`, the
  two new `shared/components/` directories, `OutboxRecord`, `classifyWriteError`, and the five
  new `@state/outbox.*` files; the test-file list grows from twelve to twelve-plus-ten.
* **Update**: [known issues](constraints/known-issues.md) — five new entries, numbered 23-27
  (after the highest number ever used, 22, so no existing cross-reference by number breaks):
  duplicate rows on replay (23), drain ordering exceptions (24), the outbox surviving logout
  (25), a hung request holding the drain lock indefinitely (26), and a timezone change between
  queueing and sending (27).
* **Update**: `CLAUDE.md` — "Things that will surprise you" now covers `addExpense`'s outbox
  routing, the two state slices and two effects classes, and the `exp-spsh-outbox` IndexedDB
  database (including how to reset it); the knowledge table gains a `write-outbox` row.

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
