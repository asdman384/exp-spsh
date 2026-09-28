# Knowledge Bundle Update Log

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
