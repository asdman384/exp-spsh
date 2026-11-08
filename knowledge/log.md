# Knowledge Bundle Update Log

## 2026-11-05 - dates you can trust

- Added submit-time dates, visible next-day refresh, and a Yesterday action.
- Removed the calendar lower bound. Explicit date choices remain fixed.
- Updated the add/load flows, glossary, and project instructions.

## 2026-11-05 - queued expenses on Dashboard

- Added pending and failed outbox rows to Dashboard lists and totals, with grey text and
  an accessible cloud icon. Added local swipe discard with full-field timestamp matching.
- Updated the table contract, outbox, state, and add/load/delete/offline concepts. The
  saved-expense service, Statistics, and send rules remain unchanged.

## 2026-11-03 — native Windows verification harness

* Replaced the Bash harness with `scripts/harness.mjs`, using Node.js to launch
  local CLIs on Windows, Linux, and macOS. Added the `npm run harness` alias.
* Updated harness references across documentation, agent instructions, permissions,
  hooks, and the hook test command fixture to the portable invocation. Commands in
  earlier verification reports use the new spelling; their recorded results are historical.

## 2026-09-28 — voice recorder simplified

* **Change**: [voice recording](flows/voice-recording.md) — the permission-first press (D14)
  is gone: no Permissions API call, no in-memory grant flag, no `requesting` status, and the
  `permission-granted` outcome is replaced by `released-early` (a release while `starting`).
  Every exit goes through one `finish(outcome)`; `limit-reached` is derived from the duration.
  Fixes a hold released during the permission query still starting an unheld recording.

## 2026-09-27 — bundle re-validation after the NgRx slim-down

Re-read all of `src/` and every concept; removed stale claims and shortened where possible.
Earlier log entries were condensed (full text is in git history).

* **Fix (voice → expenses)**: [voice recording](flows/voice-recording.md) (rewritten, shorter),
  [Gemini](interfaces/gemini-api.md), [add expense](flows/add-expense.md) — recognized
  expenses are queued through `ExpensesService.add`, no longer only logged; recognition errors
  when no valid expense survives; the Gemini key is `keys.GGG_KEY`, not `API_KEY`; a failure
  toasts the raw error with `source: 'Gemini'`.
* **Fix (stale NgRx facts)**: [overview](architecture/overview.md) (one `app` slice, signal
  services, Gemini in the layer diagram), [dependency wiring](architecture/dependency-wiring.md)
  (`provideAppInitializer`, full root-provided list, no `loggerType`),
  [state management](architecture/state-management.md), [NgRx actions](interfaces/ngrx-actions.md),
  [index](index.md), [interfaces index](interfaces/index.md) (no `Outbox` action group),
  [flows index](flows/index.md) (voice recording listed).
* **Fix (config/CI)**: [configuration](operations/configuration-and-secrets.md),
  [GitHub Pages](systems/github-pages.md), [CI](operations/ci-and-deployment.md),
  [Google backend](systems/google-workspace.md), [security posture](constraints/security-posture.md),
  [technical constraints](constraints/technical-constraints.md),
  [build and serve](operations/build-and-serve.md) — CI now passes `APP_ID`; `GGG_KEY` is
  documented and its absence from CI and `keys.example.json` recorded.
* **Fix (tests)**: [testing](operations/testing.md) — coverage table matches the current
  spec files (deleted outbox-NgRx and drain-lock specs removed; expenses, outbox service,
  voice, Gemini, service-worker-mode specs added).
* **Known issues**: removed the fixed #29 (empty `APP_ID` in CI) and its references; added #32
  (`GGG_KEY` missing from CI and the template) and #33 (Gemini failure toasts the raw error);
  #2/#3 now point at `ExpensesService.delete`.
* **Also**: [code conventions](constraints/code-conventions.md) (`inject()` in new code,
  signal-service pattern), [toolchain](systems/toolchain.md) (`@google/genai`, Vitest
  `^4.1.11`), [offline](flows/offline-and-updates.md), [glossary](domain/glossary.md),
  [source map](references/source-map.md). `CLAUDE.md`'s Gemini and prerequisite notes updated.

## 2026-09-27 — Voice record button disabled while loading

* **Update**: `VoiceRecordButtonComponent` reads `loadingSelector` and sets `disabled` while
  the app is loading; `voice-recording.md` describes it. Its spec stubs `Store` with a
  controllable `loading$` and covers the disabled state.

## 2026-09-27 — OutboxDrainLock removed

* **Removal**: `OutboxDrainLock` (`src/services/outbox/outbox-drain-lock.service.ts`) and its
  spec, and the Web Lock `exp-spsh-outbox-drain`. The app is a phone PWA used in a single tab,
  so cross-tab coordination guarded an impossible case. `OutboxService.runPassAsync` calls
  `runPass` directly; the in-tab single-flight and `sessionSent` stay.
* **Update**: `write-outbox.md`, `known-issues.md` #26, `dependency-wiring.md`,
  `source-map.md`, `testing.md`, and `CLAUDE.md` no longer mention the lock. The outbox specs
  count passes through `countCompletedPasses` instead of the lock stub.

## 2026-09-27 — OutboxDrainLock.run takes and returns a Promise

* **Update**: `OutboxDrainLock.run(work)` (`src/services/outbox/outbox-drain-lock.service.ts`)
  is now `async`, takes `() => Promise<T>` and returns `navigator.locks.request`'s promise
  directly; the Observable wrapper is gone. `OutboxService.runPassAsync` awaits it without
  `firstValueFrom`/`from` conversions. Behaviour (exclusive lock, release on settle, unlocked
  fallback logged once) is unchanged, so no concept file changes.

## 2026-09-27 — The outbox moves out of NgRx into OutboxService

* **Creation**: `OutboxService` (`src/services/outbox/outbox.service.ts`) — root service with
  `records` / `pendingCount` / `failedCount` signals, `sent$`, `init()`, `add()`, `sync()`.
  It carries the drain loop, triggers, preconditions, Retry/Discard, failure notice, and
  announcements unchanged. `init()` runs from `provideAppInitializer`. `ExpensesService.add`
  calls `OutboxService.add`; the post-send reload listens to `sent$`. `outbox-messages.ts`
  moved to `src/services/outbox/`.
* **Removal**: `OutboxActions`, `OutboxEffects`, the `outbox` reducer, model, and selectors;
  the store now has only the `app` slice and `AppEffects`.
* **Update**: [write outbox](architecture/write-outbox.md),
  [state management](architecture/state-management.md), [NgRx actions](interfaces/ngrx-actions.md),
  [add expense](flows/add-expense.md), [load expenses](flows/load-expenses.md),
  [offline](flows/offline-and-updates.md), [dependency wiring](architecture/dependency-wiring.md),
  [known issues](constraints/known-issues.md), [code conventions](constraints/code-conventions.md),
  [troubleshooting](operations/troubleshooting.md), [source map](references/source-map.md),
  [architecture index](architecture/index.md), [knowledge index](index.md).
* **Update**: `CLAUDE.md` — the outbox bullet names `OutboxService` and the single slice.

## 2026-09-27 — Expenses move out of NgRx into ExpensesService

* **Creation**: `ExpensesService` (`src/modules/dashboard/expenses.service.ts`) — root
  service holding the expense list in a signal, with `load`, `add`, and `delete`. `add`
  always enqueues into the write outbox (`drain: true`); the live write path and its routing
  are gone. The service reloads the last sent record's day on `drainCompleted` while on
  `/dashboard`.
* **Removal**: `AppActions.addExpense`/`deleteExpense`/`loadExpenses`/`storeExpenses`,
  `AppState.expenses`, `expensesSelector`, `AppEffects.addExpense$`/`deleteExpense$`/
  `loadExpenses$`, `OutboxEffects.reloadOnDrainCompleted$`.
* **Update**: [state management](architecture/state-management.md),
  [NgRx actions](interfaces/ngrx-actions.md), [write outbox](architecture/write-outbox.md),
  [add expense](flows/add-expense.md), [load expenses](flows/load-expenses.md),
  [delete expense](flows/delete-expense.md), [statistics](flows/statistics.md),
  [offline](flows/offline-and-updates.md), [overview](architecture/overview.md),
  [app system](systems/exp-spsh-app.md), [known issues](constraints/known-issues.md) #24,
  [source map](references/source-map.md).
* **Update**: `CLAUDE.md` — "Things that will surprise you" describes `ExpensesService` and
  the always-queued add.

## 2026-09-26 — Gemini expense recognition (log only)

* **Creation**: [Gemini expense recognition](interfaces/gemini-api.md) — root-provided
  `ExpenseRecognitionService` (`src/services/expense-recognition/`) sends a `VoiceRecording`
  to `gemini-3.5-flash-lite` through `@google/genai` with `keys.API_KEY` and a
  `responseJsonSchema`, and maps the reply to `Expense[]`. The SDK is loaded by dynamic
  `import()` so it stays out of `main`. `DashboardPageContainer` sends every new recording and
  `log()`s the JSON result; nothing is dispatched. OAuth scopes are unchanged.
* **Update**: [voice recording](flows/voice-recording.md) — recordings now go to Gemini.
* **Update**: [security posture](constraints/security-posture.md) — `API_KEY` also reaches
  Gemini.
* **Update**: [source map](references/source-map.md), [interfaces index](interfaces/index.md),
  [knowledge index](index.md).
* **Update**: `CLAUDE.md` — "Things that will surprise you" gains the Gemini bullet.

## 2026-09-26 — CI installs with `npm ci`

* **Update**: [GitHub Pages](systems/github-pages.md),
  [CI and deployment](operations/ci-and-deployment.md) — the `build` job runs `npm ci` instead
  of `npm install`, so CI installs exactly the committed `package-lock.json` and fails when it
  disagrees with `package.json`; `actions/setup-node` now caches npm downloads (`cache: npm`).
  The "lockfile is not strictly enforced" gap is closed.

## 2026-09-26 — robots.txt in the deploy

* **Update**: [GitHub Pages](systems/github-pages.md) — the `build` job now writes
  `robots.txt` (`User-agent: *` / `Disallow: /`) into `dist/exp-spsh` before uploading the
  Pages artifact.

## Earlier history (condensed)

* **2026-09-24** — The service worker runs only in production builds
  (`SERVICE_WORKER_IN_DEV` switch, stale-worker removal in `main.ts`). Hold-to-record voice
  note added (`VoiceRecorderService`, `VoiceRecordButtonComponent`, in-memory `VoiceRecording`).
* **2026-09-23** — `logout()` revokes a per-strategy `revocableToken()` (closed #30). Full
  bundle re-validation at `6cad020`: zoneless bootstrap, `withXhr()`, DST-safe serial dates,
  `EXPENSE_COLUMNS`, gviz empty-cell handling, `Memento` rollbacks; known issues #28–#31 added.
* **2026-09-20** — OAuth scope narrowed from `auth/spreadsheets` to `auth/drive.file`; setup
  picks the spreadsheet with Google Picker (`PickerService`, `APP_ID`).
* **2026-09-15** — Angular 21 → 22 and NgRx 22 via `ng update`; TypeScript 6.0.3, Node
  `>= 22.22.3`; `withXhr()` added; components on the `OnPush` default.
* **2026-09-13** — `baseHref` `/exp-spsh/` and build-output-relative ngsw globs (offline
  start fixed); IndexedDB storage hardening; corrections to state management,
  troubleshooting, delete and load flows.
* **2026-09-12** — Write outbox for `addExpense` introduced (IndexedDB queue, drain loop,
  failure notice, toolbar badge; known issues #23–#27). Harness builds into `tmp/harness-dist`.
  Dashboard form moved to Signal Forms; `ExpensesTableComponent` to signal inputs/outputs.
* **2026-09-11** — Bundle swept to present-tense descriptions; `getAppConfig()` became async
  with lazy StoreDevtools; standalone-only components (no shared UI module).
* **2026-09-08** — Effect error surfacing: `operationFailed`, `lastError`, fixed-copy toasts.
* **2026-09-05** — Bundle created (OKF v0.2): architecture, domain, flows, interfaces,
  systems, operations, constraints, source map.

* **2026-11-03** � Dashboard expense state, operations, date windows, and voice recognition
  live in a page-scoped `DashboardPageViewModel`; the component retains form validation,
  display configuration, and action handlers. Submission/reset regression tests pin behaviour.
  Verification: seven dashboard tests pass before extraction; after extraction, typecheck,
  production build, and 283 tests pass (two skipped). The full harness reports the pre-existing
  empty lifecycle method lint error in `test-perf.component.ts:21`. The test fixture stubs
  global `log()` for submit coverage. Architecture and flow references match the new owner;
  the temporary refactoring script is removed. Crapper, dryer, and mutator are unavailable.

* **2026-11-04** - Expense reads cover month start through the selected day, inclusive.
  The dashboard computes its daily list from the service signal. Explicit statistics ranges
  stay unchanged; outbox completion uses the same monthly load rule.
  Work log: read the project and ub-mode rules and the load callers; confirmed the selected-day
  cutoff and permission to update two test expectations with the user; added regression tests
  and observed the two expected failures; changed the service and view-model; updated the two
  existing expectations and the current-behaviour documentation; checked the diff and worktrees
  (only the active worktree exists, so there is nothing to remove).
  Verification: typecheck, production build, and 287 tests pass (two skipped); lint for changed
  TypeScript files passes. Full lint reports the existing empty lifecycle method in
  `src/modules/playground/test-perf/test-perf.component.ts:21`. The first test process remained
  open after results and was stopped; later harness runs completed. Crapper, dryer, and mutator
  are not installed or exposed as tools. The log retains its existing bytes because an older
  entry contains a non-UTF-8 byte. The change is committed locally for review, without push.

* **2026-11-04** - Follow-up: use `to` for the selected day. Preserve a custom range only
  when both `from` and `to` are supplied. Update dashboard and outbox callers and load docs.
  Tests first show three expected failures; after the change, 288 tests pass (two skipped).
  Typecheck and production build pass. Full lint retains the existing playground lifecycle
  error. The previous change is staged rather than committed at the start of this follow-up;
  leave the index and commit history as supplied by the user.

* **2026-11-05** - Add dashboard daily, month-through-day, and signed Debt totals from loaded expense signals. Include local date bounds, finite amount handling, English decimal formatting, and responsive summary text. The owner removes all request tracking and service ownership changes from scope; ExpensesService and its tests remain unchanged. Add summary and layout regression tests. Remove the unused empty playground lifecycle method that blocks lint. Verification results follow after the final harness run.

  Verification: lint and production build pass; 298 tests pass with two pre-existing skips. The final targeted typecheck passes after correcting nullable DOM typing in a test. Chromium layout assertions cover long amounts at 320 CSS pixels and 200% text size. Manual visual inspection is unavailable because the browser tools cannot attach. Existing build warnings concern snow CSS size and p-retry CommonJS.


## 2026-11-06 - Date swipe overlay

- Added gesture tests first and confirmed failure without the overlay.
- Added a Date overlay, component handlers, and a directional wave.
- Kept tap-to-open and vertical scrolling; cancelled gestures do not open the calendar.
- Updated the add-expense flow and project instructions.

## 2026-11-06 - Date swipe navigation

- Added calendar-boundary gesture tests to check date changes and expense reloads.
- Changed the swipe handler to copy the selected date, move it by one local day, and call onDateChange.
- Updated the current-behavior documentation. Existing view-model tests reference the removed selectYesterday method and block test compilation.


## 2026-11-06 - Statistics comparison (spending-expert idea 5)

- Read CLAUDE.md, ub-mode, ADLC tracker/workcycle/check-health/reply-format, the idea,
  statistics flow, expense mapping, and shared table contracts to define scope.
- Checked task inventory and Git state. No matching open task or initial file changes.
  The repository has no ADLC health configuration, so used the documented harness.
- Added pure summary tests first. Confirmed three assertion failures against an empty
  implementation with an isolated test configuration under tmp/.
- Added category ranking, spending shares, and signed previous-month deltas. Included
  previous-only categories to show spending that stops. Used Map for arbitrary names.
- Kept debt in its own table and total. Kept drill-down restricted to its expense group.
- Added a page-scoped two-month range read to avoid sharing Dashboard data or combining
  responses from different selections. Tested January rollover, stale responses, failure,
  reconnect, and subscription cleanup. Added visible loading/error states and Retry.
- Kept share and delta below the amount to avoid extra table columns on small screens.
  Preserved checkbox selection, category detail, and transition animations.
- Updated project instructions and knowledge concepts to state current behavior.
- Final harness: lint and production build pass. Typecheck and test compilation are blocked
  by the existing selectYesterday call in dashboard-page.view-model.spec.ts:91. Left that
  unrelated test unchanged. Production build retains snow CSS and p-retry warnings.
- Browser inspection is omitted at the user's request. Automated tests use the existing
  headless Chromium runner. Crapper, Dryer, and Mutator are not installed or available as
  connected tools; their checks are not run.
- Worktree review finds only the active main worktree; nothing can be reclaimed. All
  temporary test configuration stays in tmp/. No user watch or serve process is stopped.
- Targeted statistics and shared-table suite: 30 tests pass. The broader run uses a
  temporary config that excludes only the pre-existing uncompilable view-model spec:
  308 pass, 2 skip, and 2 fail in unchanged Dashboard swipe logging tests. The existing
  swipe handler has no console.log call; those assertions are unrelated to statistics.
- Reviewed the diff and ran git diff --check. Saved the implementation in one local
  commit for review; no push is made.


## 2026-11-06 - Exclude debt from category details

- Inspected the owner's staged layout changes and confirmed the requested behavior:
  keep the Debt total in the header, exclude debt from spending statistics and detail.
- Updated the stale component test for the current single-table layout. Normalized new
  test text to UTF-8. Reproduced a debt row appearing in the category detail.
- Added the missing debt filter before detail rows and their total are built. Kept the
  header, summary calculations, staged files, and layout unchanged.
- Updated CLAUDE.md and the statistics concept to describe the current header and detail.
- All 12 statistics tests pass. Browser inspection is omitted at the owner's request.
- No commit or staging changes are made because the index contains the owner's work.
- Final harness: lint and production build pass. Typecheck and full test compilation
  remain blocked by the unchanged selectYesterday call in dashboard-page.view-model.spec.ts:91.
  git diff --check passes. Crapper, Dryer, and Mutator remain unavailable.


## 2026-11-06 - Debt flag does not affect statistics

- Corrected the previous interpretation after the owner's explicit instruction: all rows
  contribute to category totals, shares, month deltas, and detail, regardless of isInDebt.
- Updated regression tests first and observed the old filtering fail. Removed debt filtering
  from category aggregation and detail. Removed unused debt-category comparisons.
- Kept isInDebt only in the separate current-month Debt header sum. Kept the layout intact.
- Added a regression test that toggles flags in either month and verifies identical statistics.
  All 13 statistics tests pass. Updated current-behavior documentation.
- Preserved the owner's staged changes. No commit, staging, or browser inspection.
- Harness: lint and production build pass; typecheck and full test compilation still fail on the existing selectYesterday test call. Source search confirms the only remaining isInDebt use in Statistics is the Debt header sum.

- 2026-11-08: Added receipt photo recognition with editable confirmation and transient image handling.
