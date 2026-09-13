# Definition of Done (extended) — Write outbox for `addExpense` (`write-outbox`)

Spec: `docs/specs/write-outbox.md`
Architecture note: `docs/architecture/write-outbox.md`
Review: `docs/reviews/write-outbox.md` (REVIEW-1, then "Re-review 1")
Created: 2026-09-12
Template: `docs/templates/dod-extended.md`. This slice changes offline behaviour, the NgRx store shape, and client-side persistence (IndexedDB). It also adds a replay path that inserts rows into the user's spreadsheet.

Approval: approved by delegation — Oleg, 2026-09-12, autonomous run requested. Oleg explicitly waived the human plan/DoD approval gate for this run. Human-only items in section 7 are still never ticked by an agent.

The orchestrator ticks sections 1–6b from cited evidence. Section 7 is **human-only**.

**Run status: final, 82/82 agent items.**
- **Fix iteration 2 (delegations 10–11) was NOT independently re-reviewed.** Oleg waived the re-review on 2026-09-13.
  - [AC7] and §6.1 are ticked on tester evidence plus a green harness.
  - [AC41] was checked by the orchestrator reading the corrected passages; the two inaccuracies it found were then fixed by the main session (MAIN-AC41).

## Evidence key

- **IMPL-REPORT**: implementer handoff, 2026-09-12 (iteration 3).
  - Verbatim `bash scripts/harness.sh --all` green: 12 files / 110 tests passed; 1 file / 2 tests skipped.
  - Verbatim `git status --porcelain`.
- **TEST-REPORT**: tester handoff, 2026-09-13 (iteration 4).
  - Verbatim `--all` green: `22 passed | 1 skipped` files, `229 passed | 2 skipped` tests.
  - Spec diff empty.
  - 10 new spec files (119 tests).
- **REVIEW-1**: `docs/reviews/write-outbox.md` §1–§6, R1–R6, N1–N12 (iteration 5). Verdict: changes-requested.
- **IMPL-FIX-1** (iteration 6) and **TEST-REPORT-2** (iteration 7): fixes for R-1..R-5 and N6, plus 6 regression tests. `--all` green: 235 passed | 2 skipped.
- **RR-1**: `docs/reviews/write-outbox.md` "Re-review 1 — fix iteration 1 — 2026-09-13", RR-0..RR-11 (iteration 9). Verdict: **changes-requested**.
  - Own `--all` green: 235 passed | 2 skipped.
  - `npm run lint` exit 0; `tsc -b` exit 0.
- **IMPL-FIX-2**: implementer handoff, 2026-09-13 (iteration 10). Fixes Re-review 1 blocking items 1 and 2.
  - Verbatim `--all` green: `Test Files 22 passed | 1 skipped (23)`, `Tests 235 passed | 2 skipped (237)`.
  - `npm run lint` exit 0 ("All files pass linting."); `npx tsc -b tsconfig.app.json tsconfig.spec.json` exit 0.
  - Spec diff empty.
- **TEST-REPORT-3**: tester handoff, 2026-09-13 (iteration 11). 9 regression tests for RR-9 item 1.
  - Verbatim `--all` green: `Test Files 22 passed | 1 skipped (23)`, `Tests 244 passed | 2 skipped (246)`.
  - `git diff --stat -- '*.spec.ts'` empty.
  - No production file touched; no production defect found.
- **MAIN-AC41**: main session, 2026-09-13, applied the two one-line fixes named in ORCH-VERIFY-AC41 (`state-management.md:173`, `troubleshooting.md:50`), re-read both against `src/@state/app.effects.ts:54-67` and `src/@state/app.reducers.ts:16-32`, and ran `bash scripts/harness.sh --all` (green, 244 passed | 2 skipped). Recorded in `docs/orchestrator-log/write-outbox.md`.
- **ORCH-VERIFY-AC41**: the orchestrator's own reading, 2026-09-13, of `knowledge/architecture/state-management.md:152-176` and `knowledge/operations/troubleshooting.md:50` against `src/@state/app.effects.ts:40-97`, `src/@state/app.actions.ts`, `src/@state/app.reducers.ts:16-57` and `node_modules/@ngrx/effects/fesm2022/ngrx-effects.mjs:174-185`. Recorded in `docs/orchestrator-log/write-outbox.md`.
- The `SubagentStop` harness hook ran at every handoff and surfaced no failure. The orchestrator has no shell tool and did not run the harness itself.

## Open at end of run

| Item | Why open | Evidence | Remaining fix |
|---|---|---|---|
| — | Nothing agent-tickable is open. [AC41] was closed by the main session (MAIN-AC41). | MAIN-AC41 | — |

## Human decisions recorded during the run

These are decisions only, not DoD ticks.

- **2026-09-13, Oleg** (chat: "оставь время постановки в очередь"), resolving REVIEW-1 N5: the failure notice `{date}` shows `enqueuedAt`, not `payload.expense.date`. This is the current behaviour, pinned by `outbox-failure-notice.component.spec.ts`.
- **2026-09-13, Oleg** ("rerun review", relayed via coordinator): re-delegate Re-review 1 as delegation 9 of 9 after the iteration-8 reviewer was stopped twice without output.
- **2026-09-13, Oleg** ("one more fix round, with the implementer fixing both blocking items. do without reviewer", relayed via coordinator):
  - The delegation cap is raised to 11: 10 = implementer, 11 = tester.
  - Re-review for this round is **waived**.

---

## 1. Acceptance criteria

### State slice

- [x] [AC1] `OutboxRecord` has exactly the D10 fields and is re-exported. `OutboxState` = `EntityState<OutboxRecord> & { draining: boolean }`.
  - Passing: REVIEW-1 §1 (verified 2026-09-13).
- [x] [AC2] `OutboxActions` is a `createActionGroup` with `source: 'Outbox'` and exactly 12 events.
  - Passing: REVIEW-1 §1 (verified 2026-09-13).
- [x] [AC3] The reducer handles exactly the listed branches.
  - Covered by `src/@state/outbox.reducers.spec.ts` (15 tests).
  - Passing; TEST-REPORT-3 harness green (verified 2026-09-13).
- [x] [AC4] Selectors are built on `createFeatureSelector<OutboxState>('outbox')`.
  - Covered by `src/@state/outbox.selectors.spec.ts` (5 tests).
  - Passing (verified 2026-09-13).
- [x] [AC5] Registration and barrel.
  - Passing: REVIEW-1 §1; `tsc -b` exit 0 (IMPL-FIX-2) (verified 2026-09-13).
- [x] [AC6] The reducer and selector specs prove every listed property.
  - Passing (verified 2026-09-13).

### Storage and lock

- [x] [AC7] Abstract `OutboxStorage` follows the D11 contract, including "every Observable ... emits once (or errors), and completes". A bare `TestBed` yields `IndexedDbOutboxStorage` without opening a DB. Implementations use a type-only import plus `implements`.
  - Passing (verified 2026-09-13).
  - Root binding, type-only imports and `implements`: REVIEW-1 §2; RR-8 row [AC7].
  - Commit-time abort errors: RR-3, plus the 3 `[AC7] ... transaction-abort durability (R-2)` tests.
  - **Synchronous-throw hang fixed** in IMPL-FIX-2. `withStore` wraps the transaction-setup body in try/catch into the once-only `fail` (`indexed-db-outbox-storage.service.ts:107-141`). `open()` resets the cached connection on `onclose` as well as `onversionchange`, behind a same-connection guard (`:56-91`). An `InvalidStateError` resets it too (`:132-140`).
  - Proven against real IndexedDB by TEST-REPORT-3, `src/services/outbox/indexed-db-outbox-storage.service.spec.ts`, describes tagged `[AC7] ... (RR-9 item 1)`. Each test bounds its wait with a `Promise.race` sentinel:
    - `should_reject_rather_than_hang_when_db_transaction_throws_InvalidStateError_during_getAll`
    - `should_reject_rather_than_hang_when_db_transaction_throws_InvalidStateError_during_add`
    - `should_reject_rather_than_hang_when_db_transaction_throws_InvalidStateError_during_updateStatus`
    - `should_reject_rather_than_hang_when_db_transaction_throws_InvalidStateError_during_remove`
    - `should_reject_rather_than_hang_when_db_transaction_throws_a_plain_error_not_InvalidStateError`
    - `should_reject_rather_than_hang_when_transaction_objectStore_throws_synchronously`
    - `should_reopen_and_succeed_when_the_next_operation_runs_after_the_connection_is_force_closed`
    - `should_not_discard_a_newer_cached_connection_when_a_stale_connections_close_event_fires_late`
  - **Not independently re-reviewed** (waived by Oleg).
- [x] [AC8] DB `exp-spsh-outbox` v1, store `writes`, keyPath `localId`, lazy open, `versionchange` close, no JSON, subscription order, `isAvailable()`.
  - Passing: RR-3 clause list (verified 2026-09-13).
  - IMPL-FIX-2 states these clauses are kept. The 7 `[AC10]` tests stay green (TEST-REPORT-3). Not re-reviewed after IMPL-FIX-2.
- [x] [AC9] `InMemoryOutboxStorage` follows the same contract and has no production reference.
  - Passing: REVIEW-1 §2; RR-8 (verified 2026-09-13).
- [x] [AC10] Real-IndexedDB behaviours.
  - Covered by the 7 named `[AC10]` tests in `src/services/outbox/indexed-db-outbox-storage.service.spec.ts`.
  - Passing after both storage fixes; TEST-REPORT-3 harness green (verified 2026-09-13).
- [x] [AC11] `OutboxDrainLock.run(work)` holds the Web Lock, releases it on complete or error, and falls back when locks are unavailable.
  - Covered by the 3 named tests in `src/services/outbox/outbox-drain-lock.service.spec.ts`.
  - Passing (verified 2026-09-13).

### Helper and service

- [x] [AC12] `classifyWriteError` implements the D3 table.
  - Covered by `src/shared/helpers/classify-write-error.spec.ts` (16 tests).
  - Passing (verified 2026-09-13).
- [x] [AC13] `SpreadsheetService` gains only `getSpreadsheetId()`.
  - Passing: RR-8 row [AC33] (verified 2026-09-13).
- [x] [AC14] Live and replayed requests are byte-identical.
  - Covered by `src/services/spreadsheet/spreadsheet.service.replay.spec.ts::should_send_the_same_method_urlWithParams_and_JSON_body_for_a_live_form_value_and_its_replayed_five_key_trim`.
  - Passing (verified 2026-09-13).

### `AppEffects.addExpense$`

- [x] [AC15] D5 routing tree.
  - Covered by `src/@state/app.effects.add-expense.spec.ts`.
  - Passing: RR-2 (verified 2026-09-13).
- [x] [AC16] The record captures `spreadsheetId` and `enqueuedAt` at routing time, with the full shape.
  - Passing (verified 2026-09-13): RR-2 and RR-10 "met".
  - Covered by `src/@state/app.effects.add-expense.spec.ts`:
    - `should_enqueue_with_the_routing_time_spreadsheetId_and_enqueuedAt_when_a_retryable_error_arrives_after_a_spreadsheet_switch`
    - `should_enqueue_with_the_routing_time_spreadsheetId_and_enqueuedAt_when_an_auth_401_error_arrives_after_a_spreadsheet_switch`
- [x] [AC17] Loading follows D9.
  - Passing: RR-2 (verified 2026-09-13).
- [x] [AC18] The `app.effects.ts` diff is confined as specified.
  - Passing: RR-2 and RR-8 (verified 2026-09-13). `app.effects.ts` was not touched in IMPL-FIX-2.
- [x] [AC19] `app.effects.add-expense.spec.ts` covers every [AC15]–[AC17] branch.
  - Passing (verified 2026-09-13).

### `OutboxEffects`

- [x] [AC20] Hydration on `ROOT_EFFECTS_INIT`.
  - Covered by `src/@state/outbox.effects.spec.ts`.
  - Passing (verified 2026-09-13).
- [x] [AC21] Persist-first, `concatMap`-ordered enqueue with a failure toast.
  - Covered by `src/@state/outbox.effects.spec.ts`.
  - Passing (verified 2026-09-13).
  - The toast path on a closed connection now works because storage errors (IMPL-FIX-2 confirmation (a), `outbox.effects.ts:128-138`; [AC7] tests).
- [x] [AC22] Triggers T1–T5, coalescing, no hot loop.
  - Covered by the 7 named tests in `src/@state/outbox.effects.spec.ts`.
  - Passing (verified 2026-09-13).
- [x] [AC23] Preconditions P1–P4.
  - Covered by the `[AC23]` describe (5 tests).
  - Passing (verified 2026-09-13).
- [x] [AC24] Pass algorithm.
  - Covered by the `[AC24]` describe (7 tests).
  - Passing (verified 2026-09-13).
- [x] [AC25] `OUTBOX_MESSAGES` verbatim; auth toast once per episode; `report-failure.ts` unchanged.
  - Passing (verified 2026-09-13).
- [x] [AC26] Success reload only on `/dashboard`, plus `allSent`.
  - Passing (verified 2026-09-13).
- [x] [AC27] Failure notice with Retry, Discard and Close.
  - Covered by the `[AC27]` describe (7 tests).
  - Passing (verified 2026-09-13).
- [x] [AC28] `outbox.effects.spec.ts` proves [AC20]–[AC27].
  - Covered by `src/@state/outbox.effects.spec.ts` (39 original tests plus 1 real-storage drain test from TEST-REPORT-3).
  - Passing (verified 2026-09-13).

### UI

- [x] [AC29] `OutboxStatusComponent` meets D12, including toolbar icon contrast.
  - Passing: RR-4 (`docs/reviews/write-outbox.md` line 814, "**[AC29]: met.**"), white on `#673ab7` ≈ 7.33:1. Regression test `should_not_carry_the_primary_theme_colour_on_the_toggle_button` (verified 2026-09-13).
- [x] [AC30] `AppComponent` has wiring changes only.
  - Passing: REVIEW-1 §3; RR-1 inventory (verified 2026-09-13).
- [x] [AC31] `OutboxFailureNoticeComponent`.
  - Covered by `outbox-failure-notice.component.spec.ts` (6 tests).
  - Passing; `{date}` = `enqueuedAt` per Oleg (verified 2026-09-13).
- [x] [AC32] Dashboard container is byte-identical.
  - Passing: RR-8 (verified 2026-09-13).

### Things that stay unchanged

- [x] [AC33] `expense-row.ts` and `addExpense` unchanged; `spreadsheet.service.spec.ts` unmodified and green.
  - Passing: RR-8 (verified 2026-09-13).
- [x] [AC34] No OAuth scope or token-lifecycle change.
  - Passing: RR-8 (verified 2026-09-13).
- [x] [AC35] `ngsw-config.json`, `angular.json`, `package.json`, `package-lock.json` unchanged; no dependency added.
  - Passing: RR-8; IMPL-FIX-2 and TEST-REPORT-3 inventories show no change to these files (verified 2026-09-13).
- [x] [AC36] The 11 other effects are byte-identical; setup and guards unchanged.
  - Passing: RR-2 md5 table and RR-8 (verified 2026-09-13).
- [x] [AC37] Nothing in the outbox touches localStorage.
  - Passing: RR-8 (verified 2026-09-13).
- [x] [AC38] The 13 existing spec files are byte-identical and pass.
  - Passing: `git diff --stat -- '*.spec.ts'` is empty (RR-1, IMPL-FIX-2, TEST-REPORT-3), and `1 skipped` file is unchanged (verified 2026-09-13).
- [x] [AC39] `harness --all` green; no `any`; no new `eslint-disable`.
  - Passing: TEST-REPORT-3 verbatim `harness: green` (lint, typecheck, build and test all passed). Lint's `no-explicit-any` error rule passed. RR-8 grep clean (verified 2026-09-13).
  - The fix-iteration-2 files were not independently re-grepped for `eslint-disable`; lint green is the evidence.

### Knowledge and CLAUDE.md

- [x] [AC40] `knowledge/architecture/write-outbox.md`: OKF frontmatter, present-tense description, listed in index.
  - Passing: RR-5 (`docs/reviews/write-outbox.md` line 854, "**[AC40]: met.**") (verified 2026-09-13).
  - IMPL-FIX-2 updated `write-outbox.md:88-95` for the `onclose` reset and the synchronous-throw error path. The orchestrator read `:82-95`: it is present tense and consistent with the fix described in IMPL-FIX-2 (verified by orchestrator — re-review waived by Oleg).
- [x] [AC41] Seven concepts in present tense, with claims that match the code.
  - **Closed** (MAIN-AC41, building on ORCH-VERIFY-AC41; not independently re-reviewed — waived by Oleg): `knowledge/architecture/state-management.md:173` now names `upsertDataSheet` (matches `src/@state/app.effects.ts:57`); `knowledge/operations/troubleshooting.md:50` now says the value reverts to the last successfully persisted one (matches `src/@state/app.reducers.ts:20-31`). `bash scripts/harness.sh --all` green afterwards: 22 passed | 1 skipped files, 244 passed | 2 skipped tests.
  - R-4 narration is fixed (RR-5). Re-review 1 item 2's false resubscription claim is **gone**, and its replacement at `state-management.md:161-172` is accurate:
    - outer `catchError` at `app.effects.ts:46,61,78,92`;
    - `defaultEffectsErrorHandler` resubscribes only on an error notification (`ngrx-effects.mjs:174-185`).
  - **Not met:**
    - `state-management.md:173-174` names a nonexistent `sheetId` trigger action. The actual trigger is `upsertDataSheet` (`app.effects.ts:57`, `app.actions.ts:14`).
    - `troubleshooting.md:50` "is missing again after a reload" is imprecise. The value reverts to the last persisted value (`app.reducers.ts:20-31`).
- [x] [AC42] `known-issues.md` entries 23–27, no renumbering.
  - Passing: REVIEW-1 §5 (verified 2026-09-13).
- [x] [AC43] `knowledge/log.md` top entry.
  - Passing: REVIEW-1 §5 (verified 2026-09-13).
  - Later entries: 2026-09-13 (IMPL-FIX-1) and 2026-09-13 (2) (IMPL-FIX-2).
- [x] [AC44] `CLAUDE.md` "surprises" section and table row.
  - Passing: RR-8 row [AC44] (verified 2026-09-13).
  - `CLAUDE.md` was untouched by both fix iterations.

## 2. Verification layers

- [x] **Build / type-check**: `bash scripts/harness.sh --build` and `--typecheck` exit 0.
  - Passing: TEST-REPORT-3 verbatim `typecheck: passed`, `build: passed`; IMPL-FIX-2 `npx tsc -b tsconfig.app.json tsconfig.spec.json` exit 0 (verified 2026-09-13).
- [x] **Unit tests**: `bash scripts/harness.sh --test` exits 0, no new skipped suites.
  - Passing: TEST-REPORT-3 `Test Files 22 passed | 1 skipped (23)`, `Tests 244 passed | 2 skipped (246)`; skip count unchanged from baseline (verified 2026-09-13).
- [x] **Full harness**: `bash scripts/harness.sh --all` exits 0.
  - Passing: TEST-REPORT-3 verbatim `lint: passed / typecheck: passed / build: passed / test: passed / harness: green`; IMPL-FIX-2 `npm run lint` exit 0 (verified 2026-09-13).
  - The last independent reviewer run was RR-1 (235 tests). No reviewer ran after fix iteration 2.

## 3. Data safety

- [x] **Only write:** the outbox's only write is `addExpense`'s single `batchUpdate` insert at row 0 of `record.payload.sheetId`, in spreadsheet `record.spreadsheetId`, sent only when that matches `getSpreadsheetId()`.
  - Confirmed: REVIEW-1 R3; RR-2 and RR-10 (verified 2026-09-13).
- [x] **No unintended deletes or overwrites:** no path can delete or overwrite a row the user did not act on.
  - Confirmed: REVIEW-1 §6 (verified 2026-09-13).
- [x] **Row-index arithmetic:** none is new.
  - Confirmed: REVIEW-1 §6 (verified 2026-09-13).
- [x] **Concurrent edits:** behaviour is described.
  - Confirmed: REVIEW-1 §6 (verified 2026-09-13).
- [x] **Date conversion:** unchanged, or the shift is stated.
  - Confirmed: REVIEW-1 §6 (verified 2026-09-13).

## 4. Compatibility with existing spreadsheets

- [x] **Column layout** unchanged in all three places.
  - Confirmed: REVIEW-1 §6; RR-8 (verified 2026-09-13).
- [x] **Previous-version spreadsheets** still load.
  - Confirmed: REVIEW-1 §6 (verified 2026-09-13).
- [x] **`setDataSheetFormats` / `setCategoriesSheetFormats`** unchanged.
  - Confirmed: REVIEW-1 §6 (verified 2026-09-13).
- [x] **Stale `localStorage`** does not break boot.
  - Confirmed: REVIEW-1 §6; RR-8 (verified 2026-09-13).
- [x] **No IndexedDB, or no existing database:** the app boots and adds expenses as before.
  - Confirmed: REVIEW-1 §6 (verified 2026-09-13).

## 5. Credentials and scopes

- [x] **No credential values** in source, logs or `lastError`.
  - Confirmed: REVIEW-1 §5; RR-8 §5.1 (verified 2026-09-13).
  - IMPL-FIX-2 adds no logging of request URLs; `withStore` errors are `DOMException`/`Error`.
- [x] **`keys.json`** still gitignored; `keys.example.json` unchanged.
  - Confirmed: RR-1 inventory (verified 2026-09-13).
- [x] **No OAuth scope change.**
  - Confirmed: [AC34] (verified 2026-09-13).
- [x] **No CI secret or console change** needed.
  - Confirmed: REVIEW-1; RR-1 (verified 2026-09-13).

## 6. Failure behaviour

- [x] **Every new failure path surfaces or is deliberately silent.**
  - Confirmed (verified 2026-09-13). The listed paths are confirmed in code by REVIEW-1 §6.
  - Commit-time aborts surface (RR-3; R-2 tests).
  - **Transaction-setup throws surface, and the drain releases the lock:**
    - IMPL-FIX-2 routes every setup throw to `fail`.
    - The 8 `[AC7] ... (RR-9 item 1)` storage tests prove rejection instead of a hang.
    - `src/@state/outbox.effects.spec.ts::should_release_the_web_lock_and_run_a_later_pass_when_db_transaction_throws_synchronously_mid_drain` (TEST-REPORT-3; real `IndexedDbOutboxStorage` + real `OutboxDrainLock`) proves the Web Lock `exp-spsh-outbox-drain` is released and a later pass runs.
    - IMPL-FIX-2 confirms the effect chains: `persistEnqueue$` → `reportFailure` (`outbox.effects.ts:128-138`); pass error → lock release (`outbox-drain-lock.service.ts:24-27,49`) → `finalize` (`outbox.effects.ts:253-259`); `retry$`/`discard$` log and complete (`:167-170`, `:186-189`).
  - **Not independently re-reviewed** (waived by Oleg).
- [x] **Offline behaviour** stated per mutation.
  - Confirmed: REVIEW-1 §6 (verified 2026-09-13).
- [x] **Rollback paths** dispatch.
  - Confirmed: REVIEW-1 §6 (verified 2026-09-13).
- [x] **Double-send guards** in place; unbounded-loop question judged.
  - Confirmed: REVIEW-1 §6 and R2; RR-3 finds N1 unreachable (verified 2026-09-13).

## 6b. Explicitly out of scope

Copied from the spec's `Out:` list. Each is ticked as *confirmed not done*. Evidence: REVIEW-1 §6b greps and diffs, re-run in RR-8 row §6b (verified 2026-09-13). The fix-iteration-2 change is limited to `indexed-db-outbox-storage.service.ts` and 4 docs files (IMPL-FIX-2 inventory), and touches none of these.

- [x] P0 #1 id column / id-based delete: confirmed not done
- [x] P1 #5 read path / cache / optimistic insert: confirmed not done
- [x] Queueing any mutation other than `addExpense`: confirmed not done
- [x] Timer-based retry or backoff: confirmed not done
- [x] Queue review screen / editing: confirmed not done
- [x] Request timeouts: confirmed not done
- [x] Background Sync / ngsw: confirmed not done
- [x] P1 #6, P1 #7, P2 #9: confirmed not done
- [x] P0 #3 PKCE/CSP, any auth change: confirmed not done
- [x] Clearing the outbox on logout or user change: confirmed not done
- [x] Live cross-tab store sync: confirmed not done
- [x] Disabling delete/reorder controls while offline: confirmed not done
- [x] `showFailureToast$` / `FAILURE_MESSAGES` / `FailureSource`: confirmed not done
- [x] Dedupe key / at-most-once delivery: confirmed not done
- [x] IndexedDB schema beyond v1: confirmed not done
- [x] Fixing live-add loss on OAuth redirect: confirmed not done
- [x] Un-skipping `src/app/app.component.spec.ts`: confirmed not done (spec diff empty; `1 skipped`)

## 7. Human-only

No agent ticks anything in this section.

- [ ] Requested by: Oleg (isd.dp.ua@gmail.com), 2026-09-12.
- [ ] Architecture note reviewed by: approved by delegation — Oleg, 2026-09-12, autonomous run requested. No human review has actually taken place.
- [ ] DoD approved by: approved by delegation — Oleg, 2026-09-12, autonomous run requested ← **the gate**, waived by Oleg for this run. No human has actually read this DoD.
- [ ] Close [AC41] with the two one-line docs fixes in "Open at end of run", by hand or via an authorised delegation, or accept it explicitly. **Fixes applied by the main session (MAIN-AC41); human acceptance still required.**
- [ ] Review fix iteration 2, or explicitly accept it without review. The re-review was waived. Unreviewed changes:
  - `src/services/outbox/indexed-db-outbox-storage.service.ts`: `withStore` try/catch, `onclose` reset, `InvalidStateError` reset.
  - 9 new tests.
  - Doc edits in `state-management.md`, `troubleshooting.md`, `write-outbox.md` and `log.md`.
- [ ] [AC45] Manual offline run on a scratch spreadsheet:
  - Online add behaves as today.
  - Offline adds A and B are queued, with badge 2 and an announcement.
  - The badge survives an offline reload.
  - Online: B lands above A, each exactly once; the table reloads and the badge clears.
- [ ] [AC46] Request-blocked run while "online":
  - A is queued with no toast; B goes behind A.
  - Unblock and tap: A then B are written, B on top, each once.
- [ ] [AC47] Two tabs, network off, two adds in tab A, network back on: each is written exactly once, and both badges clear after the next pass.
- [ ] [AC48] Deleted `data_Scratch` tab:
  - The notice shows the summary and Retry/Discard/Close.
  - Retry reopens it after the next pass.
  - Discard clears the badge.
- [ ] [AC49] AXE scan in the pending and failed states and with the notice open. Check for:
  - no new violations
  - an accessible name
  - keyboard operability
  - no crowding at 360 px
  - contrast:
    - toolbar icon ≈ 7.33:1 (RR-4)
    - **`warn` badge: white 9 px text on `#f44336` ≈ 3.68:1, below 4.5:1; fill ≈ 1.99:1 against the toolbar** (RR-N4)
    - `accent` badge ≈ 12.0:1
    - notice focus and reach (N12)
- [ ] Verified against a scratch spreadsheet by: (name). Required before any real expense data is used.
- [ ] Change reviewed and accepted by: (name).
- [ ] Version bumped in `package.json` (a denied write path for agents).
