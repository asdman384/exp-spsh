# Knowledge Bundle Update Log

## 2026-09-08

* **Update**: Reflected the `effect-error-surfacing` feature
  (`docs/specs/effect-error-surfacing.md`, `docs/architecture/effect-error-surfacing.md`)
  across the bundle — the 7 remote-calling effects now dispatch `operationFailed` and show a
  `MatSnackBar` toast on failure, instead of failing silently.
* **Update**: [state management](/architecture/state-management.md) — new `AppState.lastError`
  field, new `lastErrorSelector`, effects catalogue updated with `showFailureToast$` and the
  `reportFailure` mechanism.
* **Update**: [NgRx action surface](/interfaces/ngrx-actions.md) — new `operationFailed`
  action documented; the "no failure actions" claim removed.
* **Update**: [known issues](/constraints/known-issues.md) — item 1 (rollback never
  dispatches) and item 10 (all errors silent) marked **fixed**; two issues surfaced during
  the fix added as new entries: item 20 (the 4 localStorage effects still have no failure
  path) and item 21 (every remote effect goes permanently unresponsive after its first
  failure of the session, since `catchError` completes rather than errors).
* **Update**: [troubleshooting](/operations/troubleshooting.md),
  [testing](/operations/testing.md), and the four affected flows
  ([add expense](/flows/add-expense.md), [delete expense](/flows/delete-expense.md),
  [load expenses](/flows/load-expenses.md), [manage categories](/flows/manage-categories.md))
  updated to match — including the new effects-testing pattern (`provideMockActions`, and the
  `log()`-must-exist-before-construction gotcha) now precedented in
  `src/@state/app.effects.spec.ts` and `src/@state/report-failure.spec.ts`.
* Two follow-up specs identified but not written: `storage-write-failures` (known issues
  item 20) and `effect-resubscription` (item 21).

## 2026-09-05

* **Initialization**: Created the OKF v0.2 bundle for exp-spsh from a full read of the
  repository at commit `78b5109` ("update tests docs") on `master`.
* **Creation**: Architecture section — [overview](/architecture/overview.md),
  [state management](/architecture/state-management.md),
  [routing and guards](/architecture/routing-and-guards.md),
  [dependency wiring](/architecture/dependency-wiring.md),
  [PWA and service worker](/architecture/pwa-and-service-worker.md).
* **Creation**: Domain section — [expense](/domain/expense.md),
  [category](/domain/category.md), [sheet and user](/domain/sheet-and-user.md),
  [spreadsheet layout](/domain/spreadsheet-layout.md), [glossary](/domain/glossary.md).
* **Creation**: Flows section — eight end-to-end flows covering authentication, setup,
  the expense lifecycle, categories, statistics, and offline behaviour.
* **Creation**: Interfaces section — the three Google boundaries plus the interceptor,
  the NgRx action surface, the shared table contract, and the localStorage keys.
* **Creation**: Systems section — the app artifact, the Google backend, GitHub
  Actions/Pages, and the development toolchain.
* **Creation**: Operations section — build and serve, testing, CI and deployment,
  configuration and secrets, troubleshooting.
* **Creation**: Constraints section — working agreements, technical constraints, security
  posture, code conventions, and [known issues](/constraints/known-issues.md) (19 entries
  derived from reading the code, none reproduced at runtime).
* **Creation**: [Source map](/references/source-map.md) as the navigation reference.
