# Definition of Done — Effect error surfacing (`effect-error-surfacing`)

Spec: `docs/specs/effect-error-surfacing.md`
Created: 2026-09-08

---

## 1. Acceptance criteria

- [x] [AC1] `app.actions.ts` declares `operationFailed: props<{ source: string; message: string }>()` under a new `// errors` group — covered by `app.reducers.spec.ts` — passing
- [x] [AC2] `app.model.ts` adds `AppError` and `lastError: AppError | null` to `AppState`, no other field changes — covered by `app.reducers.spec.ts` — passing
- [x] [AC3] `app.reducers.ts` `initialState.lastError = null`, one `on(operationFailed, …)` branch, immutable spread — covered by `app.reducers.spec.ts` — passing
- [x] [AC4] `app.selectors.ts` exports `lastErrorSelector` — implemented; exercised indirectly via `app.reducers.spec.ts` — passing
- [x] [AC5] `app.reducers.spec.ts` proves initial `null`, `id` increments on repeat identical payloads, other keys untouched — `app.reducers.spec.ts` (4 tests) — passing
- [x] [AC6] `toMessage(e: unknown): string` in `shared/helpers/index.ts`, no `any` — covered by `shared/helpers/index.spec.ts::toMessage` — passing
- [x] [AC7] `shared/helpers/index.spec.ts` gains `describe('toMessage')`, 13 existing `isExpenseEqual` tests untouched — 9 new + 13 original = 22 passing in that file — passing
- [x] [AC8] `report-failure.ts` exports `FailureSource`, `FAILURE_MESSAGES`, `reportFailure(source, store)` — covered by `report-failure.spec.ts` — passing
- [x] [AC9] `reportFailure(...)` completes without emitting; dispatches `log` → `loading(false)` → `operationFailed` in order — `report-failure.spec.ts::should_complete_without_emitting_and_dispatch_loading_false_then_operationFailed_in_order` — passing
- [x] [AC10] `report-failure.spec.ts` asserts dispatch order/payloads and that dispatched `message` is never raw error text — `report-failure.spec.ts` (4 tests) — passing
- [x] [AC11] `loadCategories$`, `addCategory$`, `deleteCategory$`, `addExpense$`, `loadExpenses$` each use `catchError(reportFailure('<name>$', this.store))` only — implemented, verified by diff read — passing
- [x] [AC12] `updateCategoryPosition$` catchError actually dispatches rollback (bug fix), plus `loading(false)` and `operationFailed` — implemented, verified by diff read — passing
- [x] [AC13] `deleteExpense$` dispatches `operationFailed` on both exit paths, rollback/backup logic otherwise byte-for-byte unchanged — implemented, verified by diff read — passing
- [x] [AC14] `AppEffects` constructor gains exactly one new param `snackBar: MatSnackBar`, appended, nothing reordered — exercised by construction in `app.effects.spec.ts` — passing
- [x] [AC15] `showFailureToast$` exists, `{dispatch:false}`, `ofType(operationFailed)`, calls `snackBar.open(message, 'Dismiss', {politeness:'assertive', verticalPosition:'top'})`, no `duration` — `app.effects.spec.ts::should_open_snackbar_exactly_once_with_message_dismiss_and_no_duration_assertive_config` — passing
- [x] [AC16] `app.effects.spec.ts` proves `showFailureToast$` behavior via `provideMockActions` + spied `MatSnackBar.open`, incl. two consecutive identical failures both open a toast — `app.effects.spec.ts` (2 tests) — passing
- [ ] [AC17] `app.config.ts` unchanged (no animations provider — confirmed, code side); snackbar appear/disappear in a manual `npm run watch` + `npm run serve` run — **manual half not yet done** — human-only, section 4
- [x] [AC18] `@state/index.ts`, `uikit.module.ts`, `spreadsheet.service.ts`, `ngsw-config.json`, `angular.json`, `package.json` all unchanged — confirmed via `git status`/`git diff --stat` — passing
- [x] [AC19] `npm test` green (13 `isExpenseEqual` + 8 `SpreadsheetService` tests still passing, plus new suites); `npm run lint` and `npx tsc -b tsconfig.app.json tsconfig.spec.json` clean — `bash scripts/harness.sh --all`: lint/typecheck/build/test all passed (9 files / 44 tests passed, 3 files / 4 tests pre-existing-skipped, 0 failed) — passing
- [ ] [AC20] Manual AXE check on a forced failure: no new violations, `role="alert"`, `Dismiss` reachable/operable by keyboard — **not yet done** — human-only, section 4

## 2. Verification layers

- [x] **Build / type-check** — `bash scripts/harness.sh --build` exits 0 (also `--typecheck` clean)
- [x] **Unit tests** — `bash scripts/harness.sh --test` exits 0, no new skipped suites (3 pre-existing skipped suites unchanged)
- [x] **Full harness** — `bash scripts/harness.sh --all` exits 0 — `harness: green`
- [ ] **Manual check in the running app** — snackbar appearance/dismissal (AC17) and AXE scan (AC20) — human-only, see section 4

## 3. Explicitly out of scope

- [x] The 4 `{dispatch:false}` localStorage effects (`saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$`, `saveCategories$`) — confirmed untouched — different failure class, follow-up spec `storage-write-failures`
- [x] Effect death after first failure (outer `catchError` completes the stream) — pre-existing, structural, follow-up spec `effect-resubscription`; [AC16] written to not assume resubscription
- [x] Any UI reading `lastError` (banner, history panel) or clearing semantics for it — none added
- [x] Retry / "Try again" affordance on the snackbar — dismiss-only, confirmed
- [x] `setup-page.container.ts` error handling (`known-issues.md` item 9) — untouched, separate flow
- [x] `deleteExpense$`'s 100-row window / positional row deletion (`known-issues.md` items 2, 3) — adjacent, not bundled, confirmed untouched
- [x] Un-skipping the three `describe.skip` suites (`known-issues.md` item 13) — confirmed still skipped (4 skipped tests in harness run)

## 4. Human-only

- [ ] Requested by: Oleg
- [x] DoD approved by: Oleg, 2026-09-08 — approved via explicit instruction to proceed to implementer → tester after reviewing the spec summary
- [ ] Change reviewed and accepted by: — **reviewer step explicitly skipped for this run at Oleg's request; no formal review occurred**
- [ ] Version bumped in `package.json` if this ships
