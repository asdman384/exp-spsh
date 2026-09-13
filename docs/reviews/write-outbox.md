# Review — Write outbox for `addExpense` (`write-outbox`)

Spec: `docs/specs/write-outbox.md`
DoD: `docs/dod/write-outbox.md`
Architecture note: `docs/architecture/write-outbox.md` (the spec's Decisions win wherever they deviate)
Reviewed: 2026-09-13
Baseline: `4f801b2` (change is uncommitted)

## Verdict

**Superseded.** The current verdict is in "Re-review 1 — fix iteration 1 — 2026-09-13" at the end of this file: **changes-requested**. The original REVIEW-1 verdict is kept unchanged below, and the DoD's REVIEW-1 citations (§1–§6, R1–R6, N1–N12) still point into this first review.

**changes-requested** (request changes).

The slice is well built. The drain loop, lock, coalescing, triggers, preconditions, classification and store wiring match the spec. Every "stays unchanged" clause holds byte-for-byte. The harness result is identical to the tester's. The wrong-spreadsheet check in the drain pass has no async gap.

Three production defects and two documentation defects still stop DoD items from being ticked:

1. **Reactive-path capture time (major, data safety).** When a live send fails and the expense is queued, `spreadsheetId` and `enqueuedAt` are captured *after* the failed request, not at routing time. A spreadsheet switch in Setup while that request hangs re-targets the expense at the new spreadsheet. That is the exact case D2 exists to prevent. [AC16] was ticked and is **not met**.
2. **IndexedDB durability (major, silent data loss).** `IndexedDbOutboxStorage` reports success when the *request* succeeds, not when the *transaction* commits, and never observes `abort`/`error`. A commit-time failure (quota, I/O, forced close) is announced as "Expense saved on this device" and then lost without a toast. This breaks D4's persist-first promise and DoD §6 item 1.
3. **Toolbar icon contrast (major, accessibility).** The status button's icon is theme-primary `#673ab7` on the primary `#673ab7` toolbar, a 1:1 contrast ratio. That fails the WCAG AA MUST in `.claude/rules/code-style.md`.
4. **[AC40]/[AC41] narration (minor, docs).** Both explicitly forbid "now/previously/since" narration, and nine places still contain it.
5. **[AC41] `state-management.md` (minor, docs).** Its corrected `catchError` claim is itself false for four effects and cites stale line numbers.

Required changes and non-blocking notes are listed in full at the end.

## Harness

`bash scripts/harness.sh --all` was run once in the background, with its log in the scratchpad. It exited 0. Verbatim:

```
=== harness summary ===
  lint:      passed
  typecheck: passed
  build:     passed
  test:      passed
harness: green
```

```
 Test Files  22 passed | 1 skipped (23)
      Tests  229 passed | 2 skipped (231)
```

This is identical to the tester's run (22 passed | 1 skipped files, 229 passed | 2 skipped tests). The build printed the budget warning `src/fun/snow/snow.component.scss exceeded maximum budget`, which predates this change (see Out of scope).

Run separately after the harness finished:

- `npm run lint` printed `Linting "exp-spsh"...` then `All files pass linting.`, with exit status `lint-exit:0`.
- `npx tsc -b tsconfig.app.json tsconfig.spec.json` printed nothing and exited with `tsc-exit:0`.

Change-set inventory:

- `git diff --stat -- '*.spec.ts'` printed **nothing** (no existing spec modified).
- `git diff --stat`, excluding CRLF warnings:

```
 CLAUDE.md                                       | 10 +++
 knowledge/architecture/dependency-wiring.md     | 14 +++-
 knowledge/architecture/state-management.md      | 70 ++++++++++++++++----
 knowledge/constraints/known-issues.md           | 10 ++-
 knowledge/flows/add-expense.md                  | 46 +++++++++----
 knowledge/flows/offline-and-updates.md          | 23 ++++++-
 knowledge/index.md                              |  1 +
 knowledge/interfaces/ngrx-actions.md            | 29 +++++++++
 knowledge/log.md                                | 49 ++++++++++++++
 knowledge/operations/testing.md                 | 22 ++++++-
 knowledge/references/source-map.md              | 20 ++++--
 src/@state/app.effects.ts                       | 87 ++++++++++++++++++++-----
 src/@state/app.reducers.ts                      |  9 ++-
 src/@state/index.ts                             |  6 ++
 src/app/app.component.html                      |  1 +
 src/app/app.component.ts                        | 18 ++++-
 src/app/app.config.ts                           |  3 +-
 src/services/index.ts                           |  3 +
 src/services/spreadsheet/spreadsheet.service.ts |  4 ++
 src/shared/helpers/index.ts                     | 29 +++++++++
 src/shared/models/index.ts                      |  1 +
 21 files changed, 396 insertions(+), 59 deletions(-)
```

- `git status --porcelain`, verbatim:

```
 M CLAUDE.md
 M knowledge/architecture/dependency-wiring.md
 M knowledge/architecture/state-management.md
 M knowledge/constraints/known-issues.md
 M knowledge/flows/add-expense.md
 M knowledge/flows/offline-and-updates.md
 M knowledge/index.md
 M knowledge/interfaces/ngrx-actions.md
 M knowledge/log.md
 M knowledge/operations/testing.md
 M knowledge/references/source-map.md
 M src/@state/app.effects.ts
 M src/@state/app.reducers.ts
 M src/@state/index.ts
 M src/app/app.component.html
 M src/app/app.component.ts
 M src/app/app.config.ts
 M src/services/index.ts
 M src/services/spreadsheet/spreadsheet.service.ts
 M src/shared/helpers/index.ts
 M src/shared/models/index.ts
?? docs/architecture/write-outbox.md
?? docs/dod/write-outbox.md
?? docs/orchestrator-log/write-outbox.md
?? docs/specs/write-outbox.md
?? knowledge/architecture/write-outbox.md
?? src/@state/app.effects.add-expense.spec.ts
?? src/@state/outbox-messages.ts
?? src/@state/outbox.actions.ts
?? src/@state/outbox.effects.spec.ts
?? src/@state/outbox.effects.ts
?? src/@state/outbox.model.ts
?? src/@state/outbox.reducers.spec.ts
?? src/@state/outbox.reducers.ts
?? src/@state/outbox.selectors.spec.ts
?? src/@state/outbox.selectors.ts
?? src/services/outbox/
?? src/services/spreadsheet/spreadsheet.service.replay.spec.ts
?? src/shared/components/outbox-failure-notice/
?? src/shared/components/outbox-status/
?? src/shared/helpers/classify-write-error.spec.ts
?? src/shared/models/outbox-record.ts
```

`git ls-files --others --exclude-standard` expands `src/services/outbox/` to four source files plus two specs, and each component directory to one component plus its spec. All ten D17 spec files are new and untracked.

## Spec compliance: open DoD items

### 1. "Exactly" and shape clauses

| DoD item | Verdict | Evidence |
|---|---|---|
| **[AC1]** | **confirmed** | `src/shared/models/outbox-record.ts:7-17` declares exactly the nine D10 fields with D10's types: `localId: string`, `kind: 'addExpense'`, `spreadsheetId: string`, `payload: { sheetId: number; expense: Expense }`, `enqueuedAt: number`, `status: 'pending' \| 'failed'`, `attempts: number`, `lastError?: string`, `failure?: 'rejected' \| 'otherSpreadsheet'`. It has no extra fields. `src/shared/models/index.ts:3` re-exports it. `src/@state/outbox.model.ts:4-6` declares `interface OutboxState extends EntityState<OutboxRecord> { draining: boolean }`, which is structurally identical to the specified intersection type. |
| **[AC2]** | **confirmed** | `src/@state/outbox.actions.ts:4-39` is `createActionGroup({ source: 'Outbox', ... })` with exactly 12 events and matching payloads: `hydrated` :8, `enqueue` :11, `enqueued` :12, `drainRequested` :15, `syncRequested` :16, `attemptStarted` :19, `succeeded` :20, `retryableFailed` :21, `terminallyFailed` :22-27, `drainCompleted` :28-33 (`lastSent: OutboxRecord \| null`), `retry` :36, `discard` :37. |
| **[AC5]** | **confirmed** | **Reducer map:** `src/@state/app.reducers.ts:34` types the map as `{ app: AppState; outbox: OutboxState }`, and `:56` adds `outbox: outboxReducer`. The diff doesn't touch the `app: createReducer(...)` body, and `:59` changes only the `metaReducers` type. **Barrel:** `src/@state/index.ts` gains `export *` for the five `outbox.*` files plus `outbox-messages`. The extra export is harmless. **App config:** the `src/app/app.config.ts` diff is exactly `+import { OutboxEffects } from 'src/@state/outbox.effects';` (:11) and `EffectsModule.forRoot(AppEffects)` → `EffectsModule.forRoot([AppEffects, OutboxEffects])` (:66). **Name collisions:** none. `tsc -b` exits 0, and an ambiguous `export *` would raise TS2308. |

### 2. Storage

| DoD item | Verdict | Evidence |
|---|---|---|
| **[AC7]** | **confirmed** (see Required 2 on contract fidelity) | **Type-only imports:** `indexed-db-outbox-storage.service.ts:11` and `in-memory-outbox-storage.ts:8` both use `import type { OutboxRecordPatch, OutboxStorage } from './outbox-storage'`. **`implements`, not `extends`:** `:23` `class IndexedDbOutboxStorage implements OutboxStorage` and `:16` `class InMemoryOutboxStorage implements OutboxStorage`. **Single runtime edge:** `outbox-storage.ts:5` is the only runtime import between the files, used by `:19` `@Injectable({ providedIn: 'root', useFactory: () => inject(IndexedDbOutboxStorage) })`. There is no runtime cycle. The production build is green, and the bare-TestBed test `describe('[AC7] OutboxStorage root binding')` at `indexed-db-outbox-storage.service.spec.ts:40` passes. |
| **[AC8]** | **confirmed** | **Constants:** `DB_NAME = 'exp-spsh-outbox'` :13, `DB_VERSION = 1` :14, `STORE_NAME = 'writes'` :15, and `createObjectStore(STORE_NAME, { keyPath: 'localId' })` :63. **Lazy open:** the class has no constructor, and `open()` is called only from `withStore` :82. **`versionchange`:** `db.onversionchange = () => { db.close(); this.dbPromise = undefined; }` :68-71. **No JSON:** `grep -rn "JSON\." src/services/outbox/` returns nothing. **Ordering:** each operation creates its transaction in a `.then` on the shared `dbPromise` (:82-85). Those callbacks run in subscription order, and IndexedDB serialises overlapping transactions by creation order. **`isAvailable()`:** :27 is exactly `return typeof indexedDB !== 'undefined' && typeof crypto?.randomUUID === 'function';`. |
| **[AC9]** | **confirmed** | **`structuredClone` both ways:** out at `in-memory-outbox-storage.ts:24`, in at :31 and :38. **Contract:** a duplicate `add` errors (:28-30); `updateStatus` and `remove` on an absent id complete quietly (:35-46). **No production reference:** `grep -rln InMemoryOutboxStorage src \| grep -v '\.spec\.ts$'` returns only `src/services/outbox/in-memory-outbox-storage.ts`, the class itself. `src/services/index.ts` doesn't export it. |

### 3. Diff-scoped clauses

| DoD item | Verdict | Evidence |
|---|---|---|
| **[AC13]** | **confirmed** | The `spreadsheet.service.ts` diff is one hunk, `@@ -34,6 +34,10 @@`, adding `getSpreadsheetId(): string { return this.spreadsheetId; }` at :37-39. The field initialiser `private spreadsheetId: string = ''` (:25) is unchanged, so the accessor returns `''` before any set. |
| **[AC18]** | **confirmed** | `git diff -U0 -- src/@state/app.effects.ts` shows these hunks: `@@ -8,0 +9 @@` and `@@ -11,0 +13 @@` (`combineLatest`, `of`), `@@ -21,3 +23,3 @@` and `@@ -25,0 +28,2 @@` (imports), `@@ -180,2 +184,43 @@`, `@@ -185,8 +230,17 @@` and `@@ -195,2 +249,2 @@` (all inside `addExpense$`), and `@@ -296 +350,2 @@` (the constructor). The constructor gains `private readonly outboxStorage: OutboxStorage` appended after `snackBar`. The only new `store.select` is `this.store.select(pendingCountSelector).pipe(take(1))` at :236, inside the `exhaustMap` projection (:229). It is not a field initialiser, and `expensesSelector` is not called. |
| **[AC30]** | **confirmed** | **`app.component.ts`:** the `src/@state` import gains `OutboxActions`, `failedCountSelector` and `pendingCountSelector` (:16-24). It imports `OutboxStatusComponent` by direct path (:28) and lists it in `imports` (:46). `pageState$` gains `pending` and `failed` (:57-58). A new `protected syncOutbox()` dispatches `OutboxActions.syncRequested()` (:96-98). **`app.component.html`:** the only change is :10, `<outbox-status [pending]="page.pending" [failed]="page.failed" (activate)="syncOutbox()">`, inside `@if (page.user)` (:9) and before the avatar button (:11). Nothing else changed, and `app.component.spec.ts` is unmodified. |
| **[AC33]** | **confirmed** | `git diff --quiet 4f801b2 -- src/services/spreadsheet/expense-row.ts` reports no change. `addExpense` (`spreadsheet.service.ts:274-291`) is outside the only hunk, so its signature, URL, params, body and `startIndex: 0` are unchanged. The diff has no range string, gviz `tq` or row-index change. `spreadsheet.service.spec.ts` is unmodified and green. |
| **[AC36]** | **confirmed** | I compared each effect's source block at `4f801b2` and in the working tree by md5 hash. `saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$`, `saveCategories$`, `loadCategories$`, `addCategory$`, `deleteCategory$`, `updateCategoryPosition$` (with rollback), `deleteExpense$` (with rollback) and `loadExpenses$` are identical. `showFailureToast$`, bounded to stop before `constructor(`, also diffs empty (10 lines). My first unbounded extraction ran into the changed constructor, which was a script artefact. `src/modules/setup` and `src/shared/guards/index.ts` are unchanged per `git diff --quiet 4f801b2`, with no untracked files under either. |
| **[AC37]** | **confirmed** | **New files:** grepping all 13 new source files for `localStorage\|LocalStorageService\|StorageService` finds one hit, a doc comment at `outbox-storage.ts:12` ("as `StorageService` / `AbstractSecurityService`"). **Modified files:** the only added line containing a match is `app.effects.ts:23`. That import already carried `LocalStorageService` at baseline and now adds `OutboxStorage`, so it is not a new occurrence. **Unchanged paths:** `src/constants`, `src/services/storage` and `app` `initialState` (outside every `app.reducers.ts` hunk). |
| **[AC32]** (reconfirm) | **confirmed** | `dashboard-page.container.{ts,html,scss}` are unchanged per `git diff --quiet 4f801b2`. |
| **[AC34]** (reconfirm) | **confirmed** | `src/services/security`, `src/http-interceptors` and `src/constants` (where `SCOPES` lives) are unchanged. |
| **[AC35]** (reconfirm) | **confirmed** | `ngsw-config.json`, `angular.json`, `package.json`, `package-lock.json` and `policy/` are unchanged. |
| **[AC16]** (ticked, **re-open**) | **not met** | On the reactive path, the record is built at `app.effects.ts:221` inside `catchError`, *after* the live request has failed. `buildRecord` reads `getSpreadsheetId()` at :196 and `Date.now()` at :198 at that moment. [AC16] requires `spreadsheetId` "at routing time", and D10 requires `enqueuedAt` at "routing time". The existing test pins a constant `'spsh-1'` (`app.effects.add-expense.spec.ts:48,289`), so it can't detect this. See **Required 1**. |

### 4. Style

| DoD item | Verdict | Evidence |
|---|---|---|
| **[AC29]** | **confirmed** for the enumerated clauses (see Required 3 for contrast) | `outbox-status.component.ts`: `changeDetection: ChangeDetectionStrategy.OnPush` :14, `input(0)` ×2 :34-35, `output<void>()` :36, `computed` for `total` :38 and `label` :40. It has no `standalone: true`, uses native `@if`, and has `aria-hidden="true"` on the icon :28 and `[attr.aria-label]` :25. `grep ngClass\|ngStyle\|HostBinding\|HostListener\|@Input\|@Output` finds nothing. `src/shared/components/index.ts` is unchanged and `grep outbox` there finds nothing. |
| `OutboxFailureNoticeComponent` vs code-style | **conforms**, with notes N5 and N12 | OnPush :25, inline template, `inject()` :46-47, `signal` with `set` :52/:55, native `@if`/`@else`, no `ngClass`/`ngStyle`, no `standalone: true`, text-labelled `type="button"` buttons :39-41, Material snackbar label and action directives. |
| **[AC39]** | **confirmed** | The harness is green with all four layers passing. Grepping the 13 new source files, the added lines of the 10 modified source files, and the 10 new spec files for `: any`, `<any>`, `as any`, `any[]` and `eslint-disable` finds **nothing**. There are no new `eslint-disable` comments at all. |

### 5. Docs

| DoD item | Verdict | Evidence |
|---|---|---|
| **[AC40]** | **not met** | **Met:** the frontmatter has `type`, `title`, `description`, `tags`, `status`, `generated`, and `sources` citing all 13 new or changed source files (`knowledge/architecture/write-outbox.md:1-51`). `knowledge/index.md:22` lists the concept under Architecture. Every required topic is present. **Narration:** `:59` "they still fail exactly as before" and `:125` "behaves byte-for-byte like it did before the outbox existed" (**Required 4**). **Claims that aren't true until Required 2 lands:** `:100-102` "The store is always a subset of IndexedDB ... a stale in-memory record is never possible" and `:133-135` "On a failed `add` (e.g. quota), the effect runs the existing `reportFailure`". |
| **[AC41]** | **not met** | Narration appears at `dependency-wiring.md:58` "which now takes", `state-management.md:31` "(this file's original subject)", `state-management.md:160` "as of this file", `add-expense.md:63` "exactly as before the outbox existed", `offline-and-updates.md:50` "since [the write outbox]", `offline-and-updates.md:52` "still fails exactly as it always has", and `testing.md:50` "and now" (**Required 4**). A claim doesn't match the code: `state-management.md:158-165` says "Every effect's `catchError` sits on the *inner* observable built inside `exhaustMap`'s projection (`app.effects.ts:101-107` ..., `:184-194` ...)". The four localStorage persist effects put `catchError` on the **outer** pipe (`app.effects.ts:46,61,78,92`). The cited lines are stale: `loadCategories$`'s `catchError` is now :109, and the `addExpense$` live-branch `catchError` is :216-222 (**Required 5**). The other clauses match the code: the add-expense row split, the toolbar indicator, the two-slice store, the `OutboxEffects` catalogue, the 12-event table, `forRoot`, the root binding, the new specs, and the source-map rows. |
| **[AC42]** | **confirmed** | **Five entries:** 23 duplicates, 24 ordering, 25 logout, 26 hung request and lock, 27 timezone, all present tense (`known-issues.md:29-30,38-40`). **Numbering:** `git diff` shows only additions, plus the item-13 row removed and re-added with byte-identical text because a newline was added at EOF. No entry was removed or renumbered. Row 21 was already absent at `4f801b2`: `git log -G'^\| 2[12] \|'` shows rows 21/22 existed in `563e693` and `ab1083e`, and were removed in `a232d15` ("update docs"), which predates the baseline. The baseline table holds only 2, 3, 11 and 13, and the highest number ever used is 22, so 23-27 is correct. See N6 on the stale citations and N9 on item 25's wording. |
| **[AC43]** | **confirmed** | The `knowledge/log.md` top entry `## 2026-09-12 (3)` covers every touched concept: write-outbox, state-management, add-expense, offline-and-updates, ngrx-actions, dependency-wiring, testing, source-map, known-issues and `CLAUDE.md`. It links both `docs/specs/write-outbox.md` and `docs/architecture/write-outbox.md`. |
| **[AC44]** | **confirmed** (nit N10) | `CLAUDE.md:83-91` covers queue routing (offline or behind the queue, into IndexedDB `exp-spsh-outbox`, drained by `OutboxEffects`), two slices and two effects classes, not-localStorage, survives logout, the DevTools reset path, and the Web Lock `exp-spsh-outbox-drain`. The knowledge table gains `\| How does the offline write queue work? \| knowledge/architecture/write-outbox.md \|`. The claims match the code, apart from the wording in N10. |

**The four stale "item 21" citations.** The citations are:

- `knowledge/flows/delete-expense.md:73`
- `knowledge/flows/load-expenses.md:84`
- `knowledge/flows/manage-categories.md:62`
- `knowledge/operations/troubleshooting.md:50` (and `:67`, which also cites items 1, 10 and 20; none of those exist at baseline either)

This change did **not** cause them. They were already stale at `4f801b2`: row 21 was removed in `a232d15`, and `deleteExpense$`, `loadExpenses$` and `updateCategoryPosition$` all have `catchError` inside their `exhaustMap` projection (`app.effects.ts:282`, `:328`, `:167`).

The updated `state-management.md:158-165` and `add-expense.md` now **explicitly contradict** them, so the bundle is internally inconsistent. The slice's own `log.md` entry points readers at the gap.

My recommendation is to fix all four in this slice as a docs-only edit, because CLAUDE.md requires knowledge to describe current behaviour. It is **non-blocking** because [AC41] limits its scope to seven named concepts (N6).

### 6. Data safety, compatibility, credentials, failure behaviour, out of scope

**§3 Data safety**

| Line | Verdict | Evidence |
|---|---|---|
| Write paths name their rows (single insert at row 0 of `payload.sheetId` in `record.spreadsheetId`, sent only on match) | **not met** | The drain path complies: the check at `outbox.effects.ts:341` comes immediately before the send at :367 (see R3). The reactive enqueue records the spreadsheet id current *after* the failed request, so an expense can be re-targeted (**Required 1**). |
| No path deletes or overwrites a row the user did not act on | **confirmed** | The outbox's only remote call is `addExpense` (`outbox.effects.ts:367`, an insert). `OutboxActions.enqueue` is produced only by `addExpense$` (`app.effects.ts:221,240,243`). No delete, update or overwrite is queued. The Required 1 re-target is an insert into the wrong spreadsheet, not an overwrite, and is tracked in the previous row. |
| Row-index arithmetic | **confirmed** | There is no new arithmetic, and the insert uses fixed `startIndex: 0` / `rowIndex: 0` (`spreadsheet.service.ts:276,282`, unchanged). `deleteExpense$` and `deleteCategory$` are byte-identical ([AC36]). |
| Concurrent edit behaviour described | **confirmed** | The row-0 insert composes with concurrent edits. Residual risks are in spec Risks and known issues 23 and 24. |
| Date conversion | **confirmed** | `expense-row.ts` is unchanged. Timezone-at-send is known issue 27. The `Date` round-trip is [AC10], passing. |

**§4 Compatibility**

| Line | Verdict | Evidence |
|---|---|---|
| Column layout unchanged in all three places | **confirmed** | `expense-row.ts` is unchanged, and the `spreadsheet.service.ts` diff is only the accessor. |
| Old spreadsheets still load | **confirmed** | No read-path file changed: `loadExpenses`/`loadLastExpenses` are outside the hunk and `expense-row.ts` is unchanged. |
| `setDataSheetFormats` / `setCategoriesSheetFormats` unchanged | **confirmed** | Both are outside the only `spreadsheet.service.ts` hunk, and `src/modules/setup` is unchanged. |
| Stale localStorage doesn't break boot | **confirmed** | No new key (`src/constants` unchanged), `app` `initialState` unchanged, and `outboxInitialState` is a literal (`outbox.reducers.ts:12`). |
| No DB or no IndexedDB boots and adds as before | **confirmed** | If `isAvailable()` is false, or the id is empty, `sendLive$(action, false)` runs (`app.effects.ts:230-232`). That is baseline's body re-homed: `loading(true)`, send, `loadExpenses` window, and `reportFailure('addExpense$')` on any error. `hydrateOnInit$` returns `EMPTY` without touching storage (`outbox.effects.ts:104-106`). A fresh DB is created by `onupgradeneeded` (:60-65), covered by [AC10]. |

**§5 Credentials, first line: no credential in source, logs or `lastError`**

**Verdict: confirmed.**

- **`lastError`:** always set from `toMessage(e)` (`app.effects.ts:221`, `outbox.effects.ts:388`). `toMessage` returns either the Google envelope message or `` `${e.status} ${e.statusText}` `` (`src/shared/helpers/index.ts:6-21`), never `HttpErrorResponse.message` or `.url`, so `lastError` can't carry `key=`. For a token-endpoint 400, `e.error.error` is a string, so it falls back to `"400 Bad Request"`.
- **`log()` calls:** the outbox's new `log(e)` calls (`outbox.effects.ts:114,168,187,267,316,330,347,379,400,426,443`) receive IndexedDB `DOMException`s or lock errors. Send errors are caught at :369-372 and never logged, and `runPass$`'s catch at :266 can't receive an `HttpErrorResponse`, because every HTTP await is inside try/catch.
- **Action logging:** `tap(log)` on `enqueue` logs the record, which holds expense fields and the spreadsheet id but no key.
- **Pre-existing exposure:** `log(e)` of an `HttpErrorResponse` in pre-existing effects is unchanged. The outbox adds **no new exposure**.

**§6 Failure behaviour**

| Line | Verdict | Evidence |
|---|---|---|
| Every new failure path surfaces or is deliberately silent | **not met** | The listed paths hold in code. `persistEnqueue$` `add` failure → `reportFailure` (:137). Hydration failure → log (:113-116). Preconditions → log (:282-297). Auth → one toast (:406-411). Terminal or mismatch → notice (:196-217). A storage error mid-pass → log, then `break` at :315-318, :329-332, :346-349, :399-402 and :425-428. **Nuances:** a failed `remove` after a successful send logs and continues (:376-380), and the next iteration retries it and breaks on a second failure. An error from the *initial* `getAll` (:303) rejects the pass, which is logged at :267, and no `drainCompleted` is dispatched. **Unhandled:** an IndexedDB transaction that aborts *after* its request succeeded is reported as success and is neither surfaced nor stated (**Required 2**). |
| Offline behaviour stated per mutation | **confirmed** | D1 and the spec's Out list, plus `offline-and-updates.md` capability rows "Add an expense → queued" and "Delete an expense, edit categories → no". The other remote effects are byte-identical. |
| Rollback paths dispatch | **confirmed** | There is no new optimistic update, and the `deleteExpense$` and `updateCategoryPosition$` rollbacks are byte-identical. |
| Double-send guards; unbounded loop judged | **confirmed**, with note N1 | **Single-flight:** `running`/`rerunRequested` (:68-69, :245-262). **Web Lock:** :277. **Fresh read per item:** :314. **Session sent-set:** :326-334, :375. The loop has no iteration bound; R2 below judges this **note-only**. |

**§6b Explicitly out of scope: confirmed not done.** Greps below cover the 13 new source files plus the added lines of the modified source files.

| Line | Verdict | Evidence |
|---|---|---|
| P0 #1 id column / id-based delete | confirmed not done | `expense-row.ts` and `deleteExpense$` are unchanged, and `grep localId src/services/spreadsheet/*.ts` finds nothing. |
| P1 #5 read path / cache / optimistic insert | confirmed not done | The outbox dispatches only `Outbox*`, `loadExpenses` (:230) and `operationFailed` (:409). It never dispatches `storeExpenses`. |
| Queueing other mutations | confirmed not done | The only `enqueue` producers are in `addExpense$`, and the other 11 effects are byte-identical. |
| Timer retry or backoff | confirmed not done | No `setTimeout`, `setInterval`, `interval(`, `timer(`, `delay(`, `retryWhen` or RxJS `retry(`. The only `retry(` hit is `OutboxActions.retry` at :461. |
| Queue review screen / editing | confirmed not done | `src/app/app.routes.ts` and `src/modules/dashboard` are unchanged, and there is no new route. |
| Request timeouts | confirmed not done | No `timeout(` or `timeoutWith`. Known issue 26 records the risk. |
| Background Sync / ngsw | confirmed not done | No `SyncManager`, `periodicSync` or `.sync.register`, and `ngsw-config.json` is unchanged. |
| P1 #6 `moveDimension`, P1 #7 schema marker, P2 #9 `drive.file` | confirmed not done | No `moveDimension`, `src/constants` is unchanged (scopes and keys), and `expense-row.ts` is unchanged. |
| Live cross-tab sync | confirmed not done | No `BroadcastChannel`. |
| Disabling delete/reorder offline | confirmed not done | No added `disabled` in modified files, and the dashboard module and `app.component.html` menu are unchanged apart from the one `<outbox-status>` line. |
| `showFailureToast$` / `FAILURE_MESSAGES` / `FailureSource` | confirmed not done | `report-failure.ts` is unchanged and `showFailureToast$` is identical. The only `FAILURE_MESSAGES` hit is a comment at `outbox-messages.ts:3`. |
| Dedupe key / at-most-once | confirmed not done | The send passes only `payload.sheetId` and the five-key `payload.expense` (:367, `app.effects.ts:192,197`), so `localId` never reaches the sheet. |
| IDB schema beyond v1 | confirmed not done | The only `indexedDB.open` is `(DB_NAME, DB_VERSION)` with `DB_VERSION = 1`. |
| Fixing live-add loss on OAuth redirect | confirmed not done | Security and interceptor are unchanged, and the non-queueing live path is baseline's body. |

## Specific risks

### R1: effect-stream survival (minor, non-blocking)

**Confirmed inside the inner projection:**

- `hydrateOnInit$`: `catchError` at :113 inside `concatMap` :103, on `storage.getAll().pipe(...)`.
- `persistEnqueue$`: `catchError(reportFailure('addExpense$', this.store))` at :137, inside `concatMap` :128 on `this.storage.add(record).pipe(...)` :129. A failed `add` completes only that inner Observable.
- `retry$`: :167 inside :160.
- `discard$`: :186 inside :182.
- The pass itself: `runPass$` catches at :266-269, and `scheduleRun`'s subscription is per pass, so a failed pass never touches `drainOnTrigger$`'s stream.
- `addExpense$`, live send: `catchError` at `app.effects.ts:216` is on the inner `addExpense(...)` pipe, inside `exhaustMap` :229.

**Deviations from D15's "every effect catches its own errors":**

- `failureNoticeOnDrainCompleted$` (:196-206), `failureNoticeOnSyncRequested$` (:208-217), `reloadOnDrainCompleted$` (:219-233), `announceAllSent$` (:235-243) and `drainOnTrigger$` (:144-153) have **no** `catchError`.
- In `addExpense$`, the queue branch (`combineLatest ... switchMap`, :234-247) has none.
- Inside `sendLive$`'s `catchError`, `buildRecord` (:221) runs unguarded.

The throwing candidates are `openFromComponent` and `buildRecord` → `crypto.randomUUID`. The latter is guarded by `isAvailable()`, and NgRx's default effects error handler resubscribes on an *error* notification (up to 10 times). So today no realistic failure completes a stream, and this is **N2**, not blocking.

### R2: possible unbounded loop in the pass (note-only, non-blocking)

**Against `InMemoryOutboxStorage`:** it can't spin. `remove` deletes from the `Map` synchronously (:43-46), so each `sessionSent` iteration removes one record and the loop is bounded by the record count. The tester's infinite loop needed a stub whose `getAll` ignores `remove`.

**Against `IndexedDbOutboxStorage`:** the next `getAll` is a later transaction on the same store, so it waits for the delete transaction to finish. It can return the record again only if the delete transaction **aborted after its request succeeded**, which `withStore` currently reports as success (Required 2). In that case:

- **Sent-set branch (:326-334):** spins on IndexedDB only, with no network, because the sent-set prevents a resend. It holds the Web Lock and `running`, and never dispatches `drainCompleted`.
- **Mismatch branch (:341-360):** the same kind of IndexedDB-only spin if its `updateStatus` commit keeps aborting.
- **Terminal branch (:415-437):** if its `updateStatus` commit keeps aborting, the record stays `pending` and is **re-sent** each iteration. For a 2xx-parse-failure "terminal" the row was actually applied, so that would be a loop of duplicate rows.

**Another tab re-adding:** not possible.

- Only `persistEnqueue$` calls `add`, always with a fresh `crypto.randomUUID()` (`app.effects.ts:194`).
- Another tab's `retry$`/`discard$` run outside the lock. Their `updateStatus` does get-then-put inside **one** readwrite transaction (`indexed-db-outbox-storage.service.ts:40-48`), so it can't resurrect a removed record.

**Iteration bound:** none.

**Classification: note-only.** Every spin path requires repeated commit-time aborts. It is **not** reachable once Required 2 makes those aborts error the Observable, because every branch then logs and `break`s. A cheap defensive guard is still worth considering. For example, the pass could stop when it selects the same `localId` twice without progress.

### R3: wrong-spreadsheet safety

**Drain path: no gap.** `pickOldestPending` → sent-set → online check (`await` at :336, the **last** async boundary) → `next.spreadsheetId !== this.spreadSheetService.getSpreadsheetId()` (:341). The next steps are all synchronous:

1. `store.dispatch(attemptStarted)` (:362). Only the reducer consumes it, and no effect listens to `attemptStarted`.
2. `this.spreadSheetService.addExpense(...)` (:367). This reads the `apiUrl` getter (`spreadsheet.service.ts:27-29`) while building the `HttpClient.post` URL at :286-290.

The URL is therefore fixed within the same synchronous run as the check, and `setSpreadsheetId` cannot interleave. The interceptor's asynchronous token refresh happens after the URL is fixed. This is the only send call in the outbox code (`grep "\.addExpense(" src` finds `app.effects.ts:210`, `outbox.effects.ts:367`, and the dashboard dispatch).

**Proactive enqueue: no gap.** `buildRecord` runs synchronously in the `switchMap` projection at routing time (:240, :243).

**Reactive enqueue: gap (Required 1).** The chain runs as follows:

1. The live request is built at :210 against spreadsheet X.
2. The request is in flight with no timeout, and on poor signal a status-0 failure can take a long time.
3. The user opens Setup from the menu. `Setup` is never disabled (`app.component.html:62`), and `setup-page.container.ts:93` calls `setSpreadsheetId(Y)`.
4. The request fails `retryable`, and `buildRecord` (:221 → :196) stamps `spreadsheetId: Y`.
5. The next drain finds `Y === getSpreadsheetId()` and sends the expense to **Y**, into gid `payload.sheetId`. D2 notes gid 0 exists in every spreadsheet. If Y has no such gid, the record instead ends `failed/rejected` rather than `failed/otherSpreadsheet`.

Either outcome defeats D2's safety invariant, and `enqueuedAt` is also skewed.

### R4: coalescing and the lock (confirmed)

- **Single-flight:** `running` is set synchronously in `scheduleRun` (:250) before any `await`, so triggers during the precondition awaits or the lock wait set `rerunRequested` (:246-248).
- **Exactly one rerun:** `finalize` (:253-259) clears `running`, consumes the flag once and calls `scheduleRun` again. `runPass$` is `from(promise)`, so there is no synchronous recursion.
- **Lock release on error:**
  - `runWork` resolves on `error` (:24-27), on `complete` (:28-31) and on a synchronous throw (:33-36), so `locks.request`'s callback promise always settles.
  - A rejection from the unguarded initial `getAll` (:303) propagates through `from(...)` → `run` → `firstValueFrom` → `runPassAsync` rejects → `catchError` logs at :266-269 → `finalize` still runs.
- **Release on unsubscribe:** teardown (:55-57) only sets `cancelled`, so the lock is released when the work settles, not when the subscriber unsubscribes. `firstValueFrom` (:277) unsubscribes right after `from(runLockedPass())` emits, and `complete` → `resolveWork` follows immediately, so this is harmless for the only caller (N11).
- **Deadlock:** none. A pass takes one lock, never nested, and holds no other resource.
- **Self-trigger loop:** none. T1 is a private `Subject` fired only by `hydrateOnInit$` (:111), not by the `hydrated` action the pass dispatches at :304 and :445. No action a pass dispatches is a trigger.
- **Starvation:** only a hung send can starve the queue, which holds `running` and the lock indefinitely. That is known issue 26, accepted by the spec.

### R5: hydration race (no drop found; self-healing)

For a `hydrated(snapshot)` to drop a record, the snapshot's `getAll` transaction must be created before the `add` transaction, and its dispatch must land after `enqueued`. That can't happen, for three reasons:

1. **Transaction ordering:** the readonly `getAll` transaction was created first and overlaps the store, so IndexedDB starts the readwrite `add` only after it finishes.
2. **Dispatch timing:** `getAll`'s result reaches `store.dispatch(hydrated)` through a promise and microtask chain: `requestToPromise` → `withStore` `.then` → `subscriber.next` → `firstValueFrom`/`tap` → dispatch at :109, :304, :445, :164 and :185. That chain drains within the success event's microtask checkpoint, before the transaction can finish.
3. **Consequence:** `hydrated` is always dispatched before the `add` even starts, and so before `enqueued` → `addOne`.

**Self-healing:** even if it happened, the next pass's opening `hydrated` (:303-304) or a Retry/Discard rehydrate would repair the store. That requires P1-P4, so an offline badge could stay stale until then.

A related ordering nit, not a drop: until boot hydration completes, `pendingCountSelector` is 0. An online add in that window (or after a failed hydration) goes live ahead of previous-session items (N7).

### R6: code style and accessibility of the new components

- **`OutboxStatusComponent`: contrast failure (Required 3).** The button sets `color="primary"` (`outbox-status.component.ts:21`) inside `<mat-toolbar color="primary">` (`app.component.html:4`). The M2 prebuilt theme (`angular.json:37`, `deeppurple-amber.css`) defines `.mat-mdc-icon-button.mat-primary { --mat-icon-button-icon-color: #673ab7 }` and `.mat-toolbar.mat-primary { --mat-toolbar-container-background-color: #673ab7; --mat-toolbar-container-text-color: white }`. It has no toolbar-scoped override for themed icon buttons, so the `cloud_upload` glyph renders `#673ab7` on `#673ab7`, a 1:1 ratio against WCAG 1.4.11's 3:1. I derived this from the theme CSS, not a browser screenshot. The glyph is `aria-hidden`, so an AXE run under [AC49] may not flag it. The existing avatar button also sets `color="primary"` but shows an `<img>`, so it is unaffected. Everything else checks out: `aria-label` from a `computed()`, a decorative badge, `type="button"`, and nothing rendered at 0/0.
- **`OutboxFailureNoticeComponent`:** conforms. Text buttons, an assertive live region, no `duration` (WCAG 2.2.1), OnPush and `inject()`. See N5 for the date, and N12 for keyboard reach and badge size, which are [AC49] human checks.

## Findings

### Required changes (blocking)

1. **Reactive enqueue captures `spreadsheetId` and `enqueuedAt` after the failed request, not at routing time.**
   - **Severity:** major.
   - **Location:** `src/@state/app.effects.ts:196` (`spreadsheetId`), `:198` (`enqueuedAt`), via `buildRecord` called at `:221` inside `catchError`.
   - **What's wrong:** see R3. The record takes whatever spreadsheet the service holds when the error arrives.
   - **Why it matters:** a spreadsheet switch during a long-hanging live add re-targets the expense at the new spreadsheet, possibly into a real gid there. D2 forbids this.
   - **Suggested direction:** capture the routing-time identity (spreadsheet id and timestamp) before the live send starts, and use it if the send fails. Add a case to the new `app.effects.add-expense.spec.ts` in which `getSpreadsheetId()` changes between routing and the live error.
   - **Blocks:** [AC16] (re-open) and DoD §3 line 1.
   - **Owner:** production code (implementer) plus spec file (tester).

2. **IndexedDB operations settle on request success, not transaction completion, and ignore `abort`/`error`.**
   - **Severity:** major.
   - **Location:** `src/services/outbox/indexed-db-outbox-storage.service.ts:80-95` (`withStore`), and the resolutions at `:34-54` and `:98-103`.
   - **What's wrong:** `add`, `updateStatus` and `remove` emit and complete once `IDBRequest.onsuccess` fires. The transaction commits later, and if it aborts, nothing reaches the subscriber. The spec allows an abort after a successful request, for example commit-time quota exhaustion, I/O failure, or a forced connection close.
   - **Why it matters:**
     - *Enqueue:* `persistEnqueue$` dispatches `enqueued`, increments the badge and announces "Expense saved on this device". The expense is then **silently lost** on reload with no toast. Today's offline add at least toasts. This breaks D4's "add to the store only after IDB confirms" and the knowledge claims at `write-outbox.md:100-102` and `:133-135`.
     - *Drain:* for `remove` and `updateStatus`, it enables the R2 spin paths, including repeated sends in the terminal branch.
   - **Suggested direction:** make each write settle on the transaction's completion and route the transaction's abort or error to the Observable's error channel, so the existing `catchError`/`break` paths handle it. Where practical, the tester can add a real-IndexedDB case in which an aborted transaction errors the Observable.
   - **Blocks:** DoD §6 line 1, and the truth of the [AC40] claims.
   - **Owner:** production code (implementer), optional spec (tester).

3. **Outbox toolbar icon is invisible: primary on primary.**
   - **Severity:** major (accessibility).
   - **Location:** `src/shared/components/outbox-status/outbox-status.component.ts:21`, rendered in `src/app/app.component.html:4,10`.
   - **What's wrong:** see R6. The icon colour equals the toolbar background.
   - **Why it matters:** `.claude/rules/code-style.md` says the UI MUST meet WCAG AA, and 1.4.11 non-text contrast is at 1:1 here. The spec already flags badge discoverability as a risk (Risks, "Toolbar crowding and discoverability"), and a glyph-less floating badge makes that worse. AXE may not catch it.
   - **Suggested direction:** let the icon take the toolbar's foreground colour, as unthemed buttons in the toolbar do, then confirm contrast in the [AC49] run.
   - **Blocks:** the code-style accessibility MUST and [AC49] (human).
   - **Owner:** production code (implementer).

4. **Change narration in knowledge concepts.**
   - **Severity:** minor.
   - **Location:** `knowledge/architecture/write-outbox.md:59,125`; `knowledge/architecture/dependency-wiring.md:58`; `knowledge/architecture/state-management.md:31,160`; `knowledge/flows/add-expense.md:63`; `knowledge/flows/offline-and-updates.md:50,52`; `knowledge/operations/testing.md:50`.
   - **What's wrong:** "now", "since", "as before", "before the outbox existed", "as it always has", "this file's original subject", "as of this file".
   - **Why it matters:** [AC40] and [AC41] explicitly require present tense with no such narration, and CLAUDE.md puts change history only in `log.md`.
   - **Suggested direction:** restate each as a plain description of current behaviour.
   - **Blocks:** [AC40], [AC41].
   - **Owner:** docs (implementer).

5. **The corrected `catchError` claim in `state-management.md` is itself inaccurate.**
   - **Severity:** minor.
   - **Location:** `knowledge/architecture/state-management.md:158-165`.
   - **What's wrong:** "Every effect's `catchError` sits on the *inner* observable built inside `exhaustMap`'s projection" is false for `saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$` and `saveCategories$` (outer-pipe `catchError` at `app.effects.ts:46,61,78,92`). The cited `app.effects.ts:101-107` and `:184-194` point at the wrong lines (now `:100-111`/`:109` and `:216-222`).
   - **Why it matters:** [AC41] requires the claims to match the code. A reader would conclude the localStorage persist effects survive a throw, but they complete.
   - **Suggested direction:** scope the statement to the seven remote effects, and cite by effect name or current lines.
   - **Blocks:** [AC41].
   - **Owner:** docs (implementer).

### Non-blocking notes

- **N1 (note), `outbox.effects.ts:311-334`.** R2. The pass has no iteration bound. It is safe against real storage once Required 2 lands; consider a defensive "same record picked twice" stop.
- **N2 (minor), `outbox.effects.ts:144-153, 196-243`; `app.effects.ts:221, 234-247`.** R1. These effects and branches have no `catchError`, a literal deviation from D15. It is mitigated by NgRx's resubscribe-on-error and the absence of realistic throws. Consider giving them the same inner guard as the rest.
- **N3 (nit), `outbox.effects.ts:130-137`.** The post-`add` `tap` (dispatch `enqueued`, `drainRequested`, announce) sits inside the `catchError` scope. A synchronous throw there after a durable `add` would show "Couldn't save that expense" for an expense that *is* queued, inviting a duplicate re-entry. Consider narrowing the guard to the storage call.
- **N4 (nit), `outbox.effects.ts:366-372`.** Drain send failures are classified but never logged, and no `tap(log)` sees `retryableFailed`/`terminallyFailed`. The log overlay (CLAUDE.md: "The log overlay is where you debug") says nothing about why a pass stopped. Consider logging the classified message, never the raw `HttpErrorResponse` (§5).
- **N5 (question), `outbox-failure-notice.component.ts:31,35`.** The notice's `{date}` is `record.enqueuedAt`, not `record.payload.expense.date`. The spec's copy ("A saved expense ({category}, {amount}, {date})") doesn't say which, and the new spec pins `enqueuedAt` (`outbox-failure-notice.component.spec.ts:18,49,65`). For a back-dated expense, the user sees when it was *queued* rather than the date they entered. **Owner decision:** which date identifies the expense to the user?
- **N6 (recommended in this slice), `knowledge/flows/delete-expense.md:73`, `load-expenses.md:84`, `manage-categories.md:62`, `operations/troubleshooting.md:50,67`.** These stale "item 21" and "items 1, 10, 20" citations predate this change but are now contradicted by `state-management.md` and `add-expense.md`. It is a docs-only fix, outside [AC41]'s list.
- **N7 (nit), `app.effects.ts:236` and `outbox.effects.ts:110`.** Before boot hydration completes, or after it fails, the pending count reads 0, so an online add goes live ahead of previous-session items. The window is small, but it's another "order sent ≠ order entered" case not listed in known issue 24.
- **N8 (nit), `indexed-db-outbox-storage.service.ts:66-73`.** There is no `onclose` handling. If the browser force-closes the connection (for example, site data is cleared), `dbPromise` keeps a closed database and every operation errors until reload. Enqueue then toasts as today.
- **N9 (nit), `known-issues.md:38` (item 25).** It says a previous user's item is "surfaced only as a spreadsheet-mismatch Retry/Discard prompt". If the next user works in the *same* spreadsheet, the item is sent silently under their session, and the notice does show category, amount and date. Consider stating both cases.
- **N10 (nit), `CLAUDE.md:83-85`.** "while another expense is already queued" means a `pending` one (`failed` records don't count), and "the next time the app can reach the spreadsheet" means at the next trigger (boot, online edge, navigation, add, Retry, tap), not continuously.
- **N11 (nit), `outbox-drain-lock.service.ts:55-57`.** Unsubscribing doesn't release the lock until the work settles. This is harmless for the single caller (`firstValueFrom` after a single-emission work), but worth a comment if `run` gains other callers.
- **N12 ([AC49] human), notice keyboard reach and badge size.** The notice is a CDK overlay appended at the end of the DOM with no focus move, the same as the existing `showFailureToast$`. `matBadgeSize="small"` renders 9 px badge text (`--mat-badge-small-size-text-size: 9px`). Both belong in the human AXE and keyboard run.
- **On ticked [AC21]:** it holds as specified. Its "persist-first" guarantee is only as strong as Required 2 makes the storage.

## Per-item verdicts (compact)

| Item | Verdict |
|---|---|
| [AC1] | confirmed |
| [AC2] | confirmed |
| [AC5] | confirmed |
| [AC7] | confirmed (contract fidelity: Required 2) |
| [AC8] | confirmed |
| [AC9] | confirmed |
| [AC13] | confirmed |
| [AC16] (ticked) | **not met**: re-open (Required 1) |
| [AC18] | confirmed |
| [AC29] | confirmed (contrast: Required 3) |
| [AC30] | confirmed |
| [AC32] | confirmed |
| [AC33] | confirmed |
| [AC34] | confirmed |
| [AC35] | confirmed |
| [AC36] | confirmed |
| [AC37] | confirmed |
| [AC39] | confirmed |
| [AC40] | **not met** (Required 4; claims depend on Required 2) |
| [AC41] | **not met** (Required 4, 5) |
| [AC42] | confirmed |
| [AC43] | confirmed |
| [AC44] | confirmed |
| §3.1 write paths | **not met** (Required 1) |
| §3.2 no delete or overwrite | confirmed |
| §3.3 row index | confirmed |
| §3.4 concurrent edits | confirmed |
| §3.5 dates | confirmed |
| §4.1 to §4.5 | confirmed |
| §5.1 credentials | confirmed (no new exposure) |
| §6.1 failure paths | **not met** (Required 2) |
| §6.2 to §6.4 | confirmed (§6.4 with N1) |
| §6b, all 14 unticked lines | confirmed not done |

## What I checked

- **Documents:** the spec in full (all 585 lines), the DoD in full, the format example, and the architecture note's line-81 wording on the `{date}` question.
- **Inventory:** `git status --porcelain`, `git ls-files --others --exclude-standard`, `git diff --stat`, `git diff --stat -- '*.spec.ts'` (empty), and `git log --oneline -1` (`4f801b2`).
- **Source diffs and new files:**
  - `git diff -- src/` in full, and `git diff -U0` hunk headers for `app.effects.ts`.
  - Read in full: `outbox.effects.ts`, all four `src/services/outbox/*` sources, `outbox-record.ts`, `outbox.{model,actions,reducers,selectors}.ts`, `outbox-messages.ts`, both new components, `network-status.service.ts`, `report-failure.ts`, `app.component.html`/`.scss`, `app.routes.ts`, and `toMessage`.
  - Also read: `spreadsheet.service.ts:20-40, 274-291`, and `app.effects.ts:38-110` and `:334-343`.
- **Effect identity:** per-effect md5 comparison of the 11 [AC36] effects between `git show 4f801b2:src/@state/app.effects.ts` and the working tree, plus a bounded `diff` for `showFailureToast$`.
- **Unchanged paths:** `git diff --quiet 4f801b2` plus an untracked-file check for setup, guards, the dashboard container and module, `expense-row.ts`, security, interceptors, constants, storage, `report-failure.ts`, `app.actions.ts`, `app.selectors.ts`, `app.routes.ts`, `ngsw-config.json`, `angular.json`, `package.json`, `package-lock.json`, `keys.example.json`, `.gitignore`, `.github`, `src/index.html`, `src/shared/components/index.ts` and `policy/`.
- **Greps:**
  - [AC37]: storage names.
  - [AC39]: `any` and `eslint-disable` across new sources, added lines and new specs.
  - [AC8]: `JSON.`.
  - [AC9]: `InMemoryOutboxStorage` in non-spec files.
  - [AC29]: the barrel, plus `ngClass`/`ngStyle`/`HostBinding`.
  - §6b: timers, `retry(`, `BroadcastChannel`, `moveDimension`, ngsw, Background Sync, `timeout(`, `FAILURE_MESSAGES`, `disabled`, IDB version, `enqueue` producers, `addExpense` callers, and `localId` in the spreadsheet service.
- **Knowledge:**
  - `git diff` for all 11 modified knowledge files and `CLAUDE.md`; read the new `knowledge/architecture/write-outbox.md` in full.
  - Narration grep with file line numbers.
  - The `known-issues.md` numbering history via `git log -G'^\| 2[12] \|'` and `git show <sha>:knowledge/constraints/known-issues.md` across its history.
  - Context around the four stale item-21 citations.
- **Tests (read only):** the capture-timing and date assertions in `app.effects.add-expense.spec.ts` and `outbox-failure-notice.component.spec.ts`, the R2 test name in `outbox.effects.spec.ts:637`, the [AC7] describe at `indexed-db-outbox-storage.service.spec.ts:40`, and the `SpreadsheetService` stubs in `app.effects.spec.ts`.
- **Theme:** `angular.json` style entries and `node_modules/@angular/material/prebuilt-themes/deeppurple-amber.css`, for icon-button, toolbar and badge variables.
- **Commands run:** `bash scripts/harness.sh --all` once (green), `npm run lint` (exit 0), `npx tsc -b tsconfig.app.json tsconfig.spec.json` (exit 0).

I modified nothing. This review file is my only write.

## Out of scope

- The build budget warning for `src/fun/snow/snow.component.scss` (13.15 kB against a 2 kB budget) predates this change.
- The pre-existing `log(e)` of `HttpErrorResponse`s in other effects can print URLs carrying `key=` to the console and overlay. The outbox does not add to this (§5).
- `knowledge/operations/troubleshooting.md:67` cites known issues 1, 10, 20 and 21, none of which exist at baseline. This predates the change; see N6.
- `docs/orchestrator-log/write-outbox.md` is untracked process output and was not reviewed.
- `app.component.html:22` uses `[ngClass]` on the avatar, and `:88` uses an inline `style`. Both predate the change and conflict with `.claude/rules/code-style.md`; neither is touched here.
- Known issue 13 (`AppComponent` spec is `describe.skip`) means the new toolbar wiring has no component-level regression net. This is expected and excluded by the spec.

## Re-review 1 — fix iteration 1 — 2026-09-13

Scope: IMPL-FIX-1 (3 production files and 11 knowledge files) and TEST-REPORT-2 (6 tests in 3 new-in-slice spec files), against the same baseline `4f801b2`.

Human decision, Oleg, 2026-09-13: the failure notice's `{date}` stays `enqueuedAt`. N5 is closed and is not revisited here.

### RR-0 Verdict

**changes-requested.**

**Fixed:**
- R-1, R-3 and R-4 are fixed and verified.
- R-2's commit-settle rework is correct for every path it targeted, and its three tests are non-vacuous.
- [AC16], [AC29], [AC40] and §3.1 are now met.

Two things still stop approval:

1. **`withStore` can hang forever (major).** Suppose something throws synchronously while the transaction is being created, e.g. `db.transaction(...)` on a connection the browser has force-closed. That throw escapes both `fail` handlers, and the Observable never emits, errors or completes.
   - This breaks D11's "emits once (or errors)" contract, on which [AC7] and §6.1 were ticked.
   - It silently wedges `persistEnqueue$` and the drain pass.
2. **R-5 is only partly fixed (minor, docs).** The rewritten paragraph correctly says an outer `catchError` completes the effect's stream, then claims NgRx's resubscription "limits" the exposure (`state-management.md:167-169`). It can't: the effect *completes* and never *errors*, so NgRx never resubscribes. [AC41] stays open.

Everything else REVIEW-1 confirmed still holds (RR-8).

### RR-1 Harness, lint, tsc, inventory

`bash scripts/harness.sh --all` was run once in the background, with its log in the scratchpad. It exited 0 (`harness-exit:0`). Verbatim:

```
=== harness summary ===
  lint:      passed
  typecheck: passed
  build:     passed
  test:      passed
harness: green
```

```
 Test Files  22 passed | 1 skipped (23)
      Tests  235 passed | 2 skipped (237)
```

This matches TEST-REPORT-2 exactly. The only build warning is the pre-existing `src/fun/snow/snow.component.scss exceeded maximum budget` (13.20 kB).

Run separately after the harness finished:

- `npm run lint` printed `Linting "exp-spsh"...` then `All files pass linting.`, with `lint-exit:0`.
- `npx tsc -b tsconfig.app.json tsconfig.spec.json` printed nothing and exited with `tsc-exit:0`.

Change-set inventory:

- `git diff --stat -- '*.spec.ts'` printed **nothing**.
- `git diff --stat` (stderr suppressed), verbatim:

```
 CLAUDE.md                                       | 10 +++
 knowledge/architecture/dependency-wiring.md     | 14 +++-
 knowledge/architecture/state-management.md      | 84 +++++++++++++++++-----
 knowledge/constraints/known-issues.md           | 10 ++-
 knowledge/flows/add-expense.md                  | 46 ++++++++----
 knowledge/flows/delete-expense.md               |  8 ++-
 knowledge/flows/load-expenses.md                |  8 +--
 knowledge/flows/manage-categories.md            |  8 +--
 knowledge/flows/offline-and-updates.md          | 23 +++++-
 knowledge/index.md                              |  1 +
 knowledge/interfaces/ngrx-actions.md            | 29 ++++++++
 knowledge/log.md                                | 92 ++++++++++++++++++++++++
 knowledge/operations/testing.md                 | 22 +++++-
 knowledge/operations/troubleshooting.md         |  5 +-
 knowledge/references/source-map.md              | 20 ++++--
 src/@state/app.effects.ts                       | 94 ++++++++++++++++++++-----
 src/@state/app.reducers.ts                      |  9 ++-
 src/@state/index.ts                             |  6 ++
 src/app/app.component.html                      |  1 +
 src/app/app.component.ts                        | 18 ++++-
 src/app/app.config.ts                           |  3 +-
 src/services/index.ts                           |  3 +
 src/services/spreadsheet/spreadsheet.service.ts |  4 ++
 src/shared/helpers/index.ts                     | 29 ++++++++
 src/shared/models/index.ts                      |  1 +
 25 files changed, 470 insertions(+), 78 deletions(-)
```

- `git status --porcelain`, verbatim:

```
 M CLAUDE.md
 M knowledge/architecture/dependency-wiring.md
 M knowledge/architecture/state-management.md
 M knowledge/constraints/known-issues.md
 M knowledge/flows/add-expense.md
 M knowledge/flows/delete-expense.md
 M knowledge/flows/load-expenses.md
 M knowledge/flows/manage-categories.md
 M knowledge/flows/offline-and-updates.md
 M knowledge/index.md
 M knowledge/interfaces/ngrx-actions.md
 M knowledge/log.md
 M knowledge/operations/testing.md
 M knowledge/operations/troubleshooting.md
 M knowledge/references/source-map.md
 M src/@state/app.effects.ts
 M src/@state/app.reducers.ts
 M src/@state/index.ts
 M src/app/app.component.html
 M src/app/app.component.ts
 M src/app/app.config.ts
 M src/services/index.ts
 M src/services/spreadsheet/spreadsheet.service.ts
 M src/shared/helpers/index.ts
 M src/shared/models/index.ts
?? docs/architecture/write-outbox.md
?? docs/dod/write-outbox.md
?? docs/orchestrator-log/write-outbox.md
?? docs/reviews/write-outbox.md
?? docs/specs/write-outbox.md
?? knowledge/architecture/write-outbox.md
?? src/@state/app.effects.add-expense.spec.ts
?? src/@state/outbox-messages.ts
?? src/@state/outbox.actions.ts
?? src/@state/outbox.effects.spec.ts
?? src/@state/outbox.effects.ts
?? src/@state/outbox.model.ts
?? src/@state/outbox.reducers.spec.ts
?? src/@state/outbox.reducers.ts
?? src/@state/outbox.selectors.spec.ts
?? src/@state/outbox.selectors.ts
?? src/services/outbox/
?? src/services/spreadsheet/spreadsheet.service.replay.spec.ts
?? src/shared/components/outbox-failure-notice/
?? src/shared/components/outbox-status/
?? src/shared/helpers/classify-write-error.spec.ts
?? src/shared/models/outbox-record.ts
```

Compared with REVIEW-1's `## Harness` inventory:

- **Tracked production files:** the same ten. Only `src/@state/app.effects.ts` changed its count (87 → 94). The other nine counts are identical: 9, 6, 1, 18, 3, 3, 4, 29 and 1.
- **Untracked production files:** file modification times against REVIEW-1's write time (2026-09-13T01:03:32) show only `indexed-db-outbox-storage.service.ts` (01:11:10) and `outbox-status.component.ts` (01:11:16) touched afterwards, besides `app.effects.ts` (01:10:12). The other 11 new source files all predate REVIEW-1.
- **Specs:** only the three new-in-slice spec files were touched after REVIEW-1: `app.effects.add-expense.spec.ts`, `indexed-db-outbox-storage.service.spec.ts` and `outbox-status.component.spec.ts`.
- **Docs:**
  - Four newly modified knowledge files (the N6 set).
  - The six R-4 files and `log.md`, re-edited.
  - `CLAUDE.md` was last modified at 2026-09-12T23:45:59, before REVIEW-1, so it is untouched.
- **New `??` entry:** `docs/reviews/write-outbox.md`, which is REVIEW-1 itself.
- **Unchanged paths:** `git diff --quiet 4f801b2` is clean, with zero untracked files, for:
  - `expense-row.ts` and `spreadsheet.service.spec.ts`
  - `src/modules/setup`, `src/shared/guards/index.ts` and `src/modules/dashboard`
  - `src/services/security`, `src/http-interceptors`, `src/constants` and `src/services/storage`
  - `report-failure.ts`, `app.actions.ts`, `app.routes.ts` and `src/shared/components/index.ts`
  - `ngsw-config.json`, `angular.json`, `package.json`, `package-lock.json`, `keys.example.json`, `.gitignore` and `policy/`

**No production file changed beyond the three named, plus docs.**

### RR-2 R-1: routing-time identity — fixed

**Code** (`src/@state/app.effects.ts`):

- **Capture:** `sendLive$` (:209-231) captures `identity = { spreadsheetId, enqueuedAt }` at :215, before `loading(true)` at :216 and before `addExpense(...)` is called at :217.
- **Use:** the reactive `catchError` (:223-229) passes that snapshot into `buildRecord(action, 1, identity, toMessage(e))` at :228. `buildRecord` (:187-207) takes `spreadsheetId` and `enqueuedAt` only from its `identity` parameter (:200, :202), so nothing reads the service or the clock after the failure.
- **Call timing:** `sendLive$` is called synchronously from the projection, either at :239 inside `exhaustMap` (:236) or at :252 inside the `switchMap` projection (:245) that makes the online/pending routing decision. The capture and the request construction therefore happen in the same synchronous run as routing.
- **Proactive branches:** `buildRecord(action, 0)` at :247 and :250 uses the default parameter (:190-193). That default is evaluated at call time inside the same `switchMap` projection, so it still captures at routing time.
- **`!usable` branch (:238-239):** `identity` is captured but never used, because `queueOnFailure` is `false`. That is one extra `getSpreadsheetId()` call and one `Date.now()` call, with no observable effect. Not a finding.

**Tests are non-vacuous:**

- `app.effects.add-expense.spec.ts:319-345` (retryable, status 0) and `:347-371` (auth, 401) set up the scenario the same way:
  - They hold the live request open with a `Subject` (:320-321, :348-349).
  - They set `Date.now` to 1000 or 3000 and `getSpreadsheetId` to `'spsh-1'` or `'spsh-A'` before dispatching.
  - They switch to `'spsh-2'`/2000 and `'spsh-B'`/4000 after dispatch but before `request$.error(...)` (:332-335, :358-361).
  - They assert the pre-switch values (:341-342, :367-368).
- REVIEW-1's code called `getSpreadsheetId()` and `Date.now()` inside `catchError`, which runs after `request$.error`. It would have stamped `'spsh-2'`/2000 and `'spsh-B'`/4000, and all four assertions would fail.
- Both statuses take the enqueue branch: status 0 classifies as `retryable` and 401 as `auth`.

**[AC15], [AC17], [AC18] reconfirmed.**

- **Hunks:** `git diff -U0` shows `@@ -8,0 +9 @@`, `@@ -11,0 +13 @@`, `@@ -21,3 +23,3 @@`, `@@ -25,0 +28,2 @@` (imports), then `@@ -180,2 +184,50 @@`, `@@ -185,8 +237,17 @@` and `@@ -195,2 +256,2 @@` (all inside `addExpense$`, :184-257), then `@@ -296 +357,2 @@` (the appended constructor parameter). This is the same hunk set as REVIEW-1 apart from the larger `addExpense$` hunk.
- **`select`:** the only new `store.select` is `pendingCountSelector` at :243, inside the projection. There is no field initialiser, and `expensesSelector` is not called.
- **D5 routing:** unchanged: `usable` :237, offline :246-247, behind the queue :249-250, live :252.
- **D9 loading:**
  - `loading(true)` at :216 comes before the send.
  - `loading(false)` at :227 comes before a reactive enqueue.
  - `reportFailure` at :224-225 handles terminal errors and the non-queueing path.
  - The proactive branches never touch loading.
  - The identity capture adds no dispatch.
- **Tests:** the 15 original tests and the 2 new ones pass.

[AC16] and §3.1 are **met**.

**[AC36] reconfirmed:** md5 of each effect block, extracted from `readonly <name> = createEffect` to the next class member, at `4f801b2` and in the working tree. The first extraction this run used an awk regex that matched nothing and hashed empty strings, so I discarded it and reran with literal matching. The line counts below are non-zero.

| Effect | base (lines) | working tree (lines) | |
|---|---|---|---|
| `saveSpreadsheetId$` | `131d73ddff32` (14) | `131d73ddff32` (14) | same |
| `saveSheetId$` | `aad7aac08ec5` (15) | `aad7aac08ec5` (15) | same |
| `saveCategoriesSheetId$` | `9c0de314723b` (17) | `9c0de314723b` (17) | same |
| `saveCategories$` | `dcd26c6929fe` (14) | `dcd26c6929fe` (14) | same |
| `loadCategories$` | `ba2159617739` (15) | `ba2159617739` (15) | same |
| `addCategory$` | `aac67d9adb5c` (16) | `aac67d9adb5c` (16) | same |
| `deleteCategory$` | `78fdf9732462` (24) | `78fdf9732462` (24) | same |
| `updateCategoryPosition$` | `2c7f8d963cc8` (28) | `2c7f8d963cc8` (28) | same |
| `deleteExpense$` | `a40393c5afa0` (65) | `a40393c5afa0` (65) | same |
| `loadExpenses$` | `0843617101dc` (16) | `0843617101dc` (16) | same |
| `showFailureToast$` | `6c6480e550a2` (11) | `6c6480e550a2` (11) | same |

The `whenOnline`, `categoriesBackUp` and `deletedExpenseBackup` member lines are also identical. Setup and guards are clean.

### RR-3 R-2: commit-settle `withStore` — fixed for its target; new hang path (blocking)

**What the code does** (`src/services/outbox/indexed-db-outbox-storage.service.ts:83-115`):

- `settled` flag at :85, and `fail` (:86-92) errors at most once.
- `this.open().then(onFulfilled, fail)` spans :94-113. The fulfilment callback:
  - creates the transaction and store (:95-96);
  - sets `oncomplete` (:99-106), which emits `result` and completes, behind the guard;
  - routes `onabort` (:107) and `onerror` (:108) to `fail`;
  - runs `work(store).then((r) => { result = r; }, fail)` (:110-112).
- `getAll` (:30-32), `add` (:34-38), `updateStatus` (:40-48) and `remove` (:50-54) all go through `withStore`, so **all four settle only on `complete`** or error.

**Exactly-once, per path:**

- **Success:** `complete` fires once. `result` is always assigned before `complete`: the last request's `success` listener resolves `requestToPromise`, and the `await`/`.then` chain runs in the microtask checkpoint after that listener, while `complete` is a later task.
- **Commit-time abort** (quota, I/O, `abort()`): `onabort` → `fail`, and `complete` never fires. One error.
- **Request error, e.g. a duplicate `add` (`ConstraintError`):**
  1. The request's `onerror` (`requestToPromise` :121) rejects, and the async `work` rejects in the same microtask checkpoint → `fail(ConstraintError)`.
  2. The event then bubbles to `transaction.onerror` → `fail`, a no-op.
  3. No code calls `preventDefault`, so the transaction aborts → `onabort`, also a no-op.

  The result is one error, no `complete` and no hang. If the handlers ran in a different order, the guard would still make the later ones no-ops.
- **`work` rejects but the transaction commits,** e.g. `store.add` throws `DataCloneError` inside the async function: no request exists, so the transaction auto-commits. `fail` runs first, then `oncomplete` sees `settled` and returns. One error.
- **No `next` after `error`, and no second `complete`:** both paths set `settled` before signalling.

**New defect: a synchronous throw in the fulfilment callback hangs the Observable.**

- **The gap:**
  - `fail` is only the *rejection* handler of `open()` (:113), so it sees only a rejected `open()`.
  - An exception thrown *inside* the fulfilment callback, before any transaction handler is attached, rejects the promise that `.then` returns, and nothing observes that promise.
- **What triggers it:**
  - `db.transaction(STORE_NAME, mode)` (:95) throws `InvalidStateError` when the connection's close-pending flag is set.
  - That flag is set when the browser force-closes a connection, for example when site data is cleared while the tab is open, or when the backing store fails.
  - Nothing handles `onclose` (N8), so `dbPromise` keeps resolving to that closed connection.
- **The result:**
  - Every later `getAll`, `add`, `updateStatus` and `remove` Observable **never emits, errors or completes**.
  - The rejection surfaces only as an unhandled-rejection report.
  - Any other synchronous throw in that callback behaves the same way: `transaction.objectStore` (:96), or `store.getAll()` in the non-async `getAll` work (:31).

**What breaks:**

- **`persistEnqueue$`** (`src/@state/outbox.effects.ts:128-137`) is a `concatMap`. The first hanging `add` blocks it: no `enqueued` action, no "Expense saved on this device" announcement, and no `reportFailure` toast. Every later enqueue waits behind it in memory, the user gets no signal, and those expenses are gone on reload.
- **The drain pass** awaits `firstValueFrom(this.storage.getAll())` (`outbox.effects.ts:303`) and never resumes. `running` (:250) stays `true` and the Web Lock (:277) stays held, so this tab never drains again and other tabs' passes queue behind the lock. It is the same wedge known issue 26 describes for a hung request.
- **`retry$` and `discard$`** (:160-162, :182-184) hang the same way.

REVIEW-1 N8 said that on a force-closed connection "every operation errors until reload. Enqueue then toasts as today". That no longer holds for this code.

The pre-fix file is untracked, and the only compiled copy (`tmp/harness-dist/browser/chunk-TN63B67D.js`) was rebuilt from the fixed source. So I cannot tell whether the pre-fix `withStore` routed this particular throw. Either way, two ticked items fail on this path:

- D11's "Every Observable is cold, emits once (or errors), and completes" ([AC7]).
- §6.1 "surfaces or is deliberately silent" (a hang is neither).

This is **blocking** (RR-9, item 1).

**D11/[AC8] clauses still hold:**

- **Lazy open:** the class has no constructor, and `open()` is called only at :94 inside the subscribe function. `[AC7] should_resolve_to_IndexedDbOutboxStorage_from_a_bare_TestBed_without_opening_a_database` passes.
- **`versionchange`:** `db.close()` plus the `dbPromise` reset at :68-71.
- **No JSON:** `grep -rn 'JSON\.' src/services/outbox/` in non-spec files finds nothing.
- **Subscription order:** each subscription attaches its `.then` to the shared `dbPromise` at subscribe time. Promise reactions run FIFO, so transactions are created in subscription order, and IndexedDB runs overlapping readwrite transactions in creation order. The `[AC10]` add-then-remove-in-the-same-tick test passes.
- **Duplicate `add` errors:** analysed above, and `[AC10] should_error_when_adding_a_duplicate_localId` passes.
- **An absent id completes quietly:**
  - `updateStatus` returns early (:43-45), the transaction commits, and the Observable emits `undefined` and completes.
  - `remove` deletes an absent key successfully, the transaction commits, and it completes.
  - Both `[AC10]` tests pass.
- **`updateStatus`:** still does get-then-put in one readwrite transaction (:40-48).
- **Unchanged:** the constants at :13-15, the `keyPath` at :63, and `isAvailable()` at :26-28.

**The three R-2 tests are non-vacuous** (`indexed-db-outbox-storage.service.spec.ts:147-250`):

- **The seam:** each helper (:164-198) replaces `IDBObjectStore.prototype.add`/`put`/`delete` with a wrapper that calls the original and adds a `success` listener calling `request.transaction.abort()`.
- **When it fires:** that listener is registered before `requestToPromise` assigns `onsuccess`, so it runs first in the same success dispatch. At that point the request has already succeeded, and the transaction is still active and uncommitted. So the abort really fires after request success and before commit.
- **Against pre-fix code:** settling on request success resolved the Observable from `onsuccess`, which still runs after the abort listener in the same dispatch. It completed before the `abort` event arrived, so each `rejects.toBeDefined()` (:205, :221-223, :241) would fail.
- **Durability checks:** a fresh instance's `getAll` (:210-212, :228-232, :246-248) proves that the write did not land, the prior status survived, and the record was not removed. A test cannot pass on the error alone.
- **Cleanup:** all three restore their spy in `finally`.
- **Gap:** none of them exercises the synchronous-throw path above, which is why the suite stays green.

**N1 (REVIEW-1 R2, unbounded loop): now unreachable.** Every spin path in R2 needed a commit-time abort to be reported as success. Those aborts now error the Observable. The error lands on the drain loop's log-and-`break` sites (`outbox.effects.ts:315-318, 329-332, 346-349, 399-402, 425-428`, per REVIEW-1 §6; the file has not changed since). A defensive guard remains optional. The new defect wedges rather than spins, and is tracked separately.

**REVIEW-1 R5 (hydration race), re-judged under commit-settle: no drop.**

- `getAll` now dispatches on its transaction's `complete` event, a task, rather than in the success microtask.
- A readwrite `add` created after an overlapping readonly `getAll` still can't run its request until that transaction finishes.
- `hydrated` is dispatched synchronously in `hydrateOnInit$`'s `tap`, or in the microtask checkpoint right after `complete` in the drain pass's `await`. Both are before the `add` request's task can run.
- So `hydrated` still precedes `enqueued`.

### RR-4 R-3: toolbar icon contrast — fixed; [AC29] met

**Template and test:**

- `outbox-status.component.ts:18-28` has no `color` attribute (`grep color` on the file finds nothing). `[matBadgeColor]` stays at :22.
- The test `should_not_carry_the_primary_theme_colour_on_the_toggle_button` (`outbox-status.component.spec.ts:85-91`) asserts that the button has no `color` attribute and no `mat-primary` class. Against REVIEW-1's `color="primary"` template both assertions would fail, so the test is non-vacuous. It is only a class/attribute proxy, because the test target loads no theme CSS (comment at :81-84).

**Effective colour.** I derived this from the CSS, not from a browser screenshot:

1. **The button's `color`:**
   - Material's icon-button rule is `color: var(--mat-icon-button-icon-color, var(--mat-sys-on-surface-variant))` (`node_modules/@angular/material/fesm2022/_icon-button-chunk.mjs`).
   - The theme sets `html { --mat-icon-button-icon-color: inherit; }` (`deeppurple-amber.css:1565`). The `#673ab7` value applies only to `.mat-mdc-icon-button.mat-primary` (:1571-1575), which no longer matches.
   - A custom property set to `inherit` on the root element resolves to the guaranteed-invalid initial value, so the `var()` falls back to `--mat-sys-on-surface-variant`.
   - The theme never defines `--mat-sys-on-surface-variant` (0 occurrences in the file).
   - The declaration is therefore invalid at computed-value time, and `color` behaves as `unset`, which means inherit for an inherited property. Reading `inherit` literally gives the same result.
2. **Inherited from the toolbar:**
   - `.mat-toolbar { color: var(--mat-toolbar-container-text-color, ...) }` (`fesm2022/toolbar.mjs`).
   - `.mat-toolbar.mat-primary { --mat-toolbar-container-text-color: white; }` (`deeppurple-amber.css:2139-2141`).
   - The toolbar is `<mat-toolbar color="primary">` (`app.component.html:4`).
   - Result: **white**.
3. **The glyph:**
   - `mat-icon { color: var(--mat-icon-color, inherit) }` (`fesm2022/icon.mjs`) combined with `html { --mat-icon-color: inherit; }` (`deeppurple-amber.css:2042`) resolves the same way, so the glyph inherits the button's white.
   - `src/styles.scss:18-20` has `.mat-icon:not(.mat-icon-no-color) { color: #636363 !important; }`, but it does **not** apply. `MatIcon` adds `mat-icon-no-color` whenever `color` is not primary, accent or warn (host binding in `icon.mjs`), and this icon has no `color`.
   - `app.component.scss` has no toolbar, icon or button rules.
4. **Contrast:** white (L = 1.0) on `#673ab7` (L ≈ 0.0933) gives 1.05 / 0.1433 ≈ **7.33:1**. That passes WCAG 1.4.11 (3:1) and even 1.4.3 (4.5:1). The implementer's figure is confirmed, although the mechanism is the fallback rather than a literal `inherit`.

**Badge colours against the toolbar.** D12 fixes these colours and calls the badge content decorative; they matter for [AC49].

| Badge | Fill / text (`deeppurple-amber.css`) | Text contrast | Fill vs `#673ab7` toolbar |
|---|---|---|---|
| `accent` (`failed` = 0) | `#ffd740` / `rgba(0, 0, 0, 0.87)` (:1781-1784) | ≈ 12.0:1 | ≈ 5.25:1 |
| `warn` (`failed` > 0) | `#f44336` / `white` (:1786-1789) | ≈ **3.68:1**, below 4.5:1 for 9 px text (`--mat-badge-small-size-text-size: 9px`, :1796) | ≈ **1.99:1** |

The counts are also in the button's accessible name, and D12 prescribes the colours, so this is a human [AC49] judgement, not a code defect in this slice (RR-N4).

**[AC29]: met.** The D12/[AC29] clauses confirmed in REVIEW-1 §4 are unchanged, and the one open question, icon contrast, is resolved above.

### RR-5 R-4 narration; [AC40]; [AC41]

I ran the case-insensitive grep `\bnow\b|previously|\bsince\b|as before|before the outbox|as it always|original subject|as of this file|no longer|used to` over all of `knowledge/`. These are the hits in the 12 in-scope files (the 7 [AC41] concepts, `write-outbox.md` and the 4 N6 files):

| Hit | In the slice diff? | Judgement |
|---|---|---|
| `write-outbox.md:187` "if not online$ right now" | yes (new file) | present-tense runtime condition |
| `write-outbox.md:193` "since the last success" | yes | a behavioural window, not change history |
| `write-outbox.md:246` "`. Send now`" | yes | UI copy |
| `write-outbox.md:251` "the queue is now empty" | yes | a runtime state condition |
| `write-outbox.md:266` "since records stay in IndexedDB" | yes | "because" |
| `dependency-wiring.md:97` "since the overlay is" | no (baseline :85) | "because" |
| `testing.md:66` "since it calls" | no (baseline :65) | "because" |
| `state-management.md:200` "is now dynamically imported … rather than statically imported" | no (baseline :154) | **change narration, pre-existing** (RR-N2) |
| `add-expense.md:43-44` "Material used to render … no longer appears" | no (baseline :40-41) | **change narration, pre-existing**, outside [AC41]'s add-expense scope (RR-N2) |

- **N6 files:** `delete-expense.md`, `load-expenses.md`, `manage-categories.md` and `troubleshooting.md` have no hits.
- **REVIEW-1's nine R-4 locations** are all gone: `write-outbox.md:59,125`, `dependency-wiring.md:58`, `state-management.md:31,160`, `add-expense.md:63`, `offline-and-updates.md:50,52` and `testing.md:50`. **R-4: fixed.**

**Wider comparative-phrasing sweep.** I also swept for comparative phrasing. The bundle's own cleanup convention (`knowledge/log.md:127-132`) treats "unchanged" as change history. These lines were added by the slice:

- `write-outbox.md:114` "today's live path, unchanged", `:121` "(unchanged)", `:123` "(unchanged, no enqueue)", `:220-221` "is unchanged"
- `ngrx-actions.md:113-114` "is reused, unmodified … no new `FailureSource` was added"
- `dependency-wiring.md:60` "the pre-existing `app.effects.spec.ts`"
- `testing.md:77` "so that file stays untouched"

REVIEW-1 did not flag them, and they are not the now/previously/since wording that [AC40] and [AC41] name, so they are **non-blocking** (RR-N1). Three other hits are legitimate uses:

- `state-management.md:107` "leave `outbox` state unchanged" describes reducer behaviour.
- `state-management.md:158-159` "still calls through" describes behaviour after a failure.
- `write-outbox.md:264` "is untouched" says that logout leaves the outbox alone.

**The reworded R-2 claims in `write-outbox.md` against the new code:**

- **`:89-92`** says "settles only when its transaction's `complete` event fires … a commit-time abort or error (quota, I/O, a forced connection close) reaches the caller as an error". That is true for a transaction that is open when the failure happens (`indexed-db-outbox-storage.service.ts:99-108`); a forced close during an open transaction aborts it. It does not cover a connection that was already closed before the operation started (RR-9 item 1), and it becomes unconditionally true once that is fixed.
- **`:103-105`** says "nothing is added to the store except through a `storage.add` whose transaction has already committed". True: `enqueued` is dispatched only after `add` emits, which is now after `complete`.
- **`:137-142`** says a failed `add` — "whether the request itself errors … or the transaction later aborts" — errors the Observable and runs `reportFailure`. True for both named cases.

**[AC40]: met.** The frontmatter, required topics and the `knowledge/index.md:22` listing are as confirmed in REVIEW-1 §5, the named narration is gone, and the claims match the code. RR-N1 applies.

**[AC41]: not met.** R-4 is fixed, but R-5 is only partly fixed (RR-6). The other [AC41] clauses stand as confirmed in REVIEW-1 §5.

### RR-6 R-5: `state-management.md` catchError placement — partly fixed

**True:**

- **`:152-159`** scopes the inner-`catchError` claim to the 7 remote-calling effects. I verified each placement in `app.effects.ts`:
  - `loadCategories$`: `catchError` at :109, inside `exhaustMap` at :105.
  - `addCategory$`: :125 inside :119.
  - `deleteCategory$`: :149 inside :136.
  - `updateCategoryPosition$`: :167 inside :161.
  - `addExpense$`: :223 inside `sendLive$`, which the `exhaustMap` projection (:236) calls either directly (:239) or through its inner `switchMap` (:252).
  - `deleteExpense$`: :289 inside :265.
  - `loadExpenses$`: :335 inside :330.

  The two citations in the text, `:109` and `:223`, are current.
- **`:161-167`:**
  - The 4 localStorage-only persist effects do put `catchError` on the outer pipe, at the cited `app.effects.ts:46, :61, :78, :92`, which are current.
  - Each logs and returns `EMPTY`, with no toast and no `operationFailed` (e.g. :46-49).
  - "A thrown error completes that effect's stream for the rest of the app's lifetime" is correct.

**Not true** — `:167-169`: "NgRx's default effects error handler resubscribes an errored effect (up to 10 times), which limits, but does not eliminate, the exposure."

- `defaultEffectsErrorHandler` (`node_modules/@ngrx/effects/fesm2022/ngrx-effects.mjs:175-185`, with `MAX_NUMBER_OF_RETRY_ATTEMPTS = 10` at :174) is a `catchError` wrapped around the effect, so it resubscribes only on an **error** notification.
- These four effects catch the error themselves and return `EMPTY`. The effect **completes**, NgRx never sees an error, and nothing resubscribes: after the first `LocalStorageService.put` throw, that effect stays dead for the session.
- The sentence tells readers these effects partly recover. That is the misreading R-5 was raised for: "A reader would conclude the localStorage persist effects survive a throw".

Blocking for [AC41], minor (RR-9 item 2).

**Same parenthetical in `troubleshooting.md:50`.** The N6 rewrite repeats it as "(NgRx resubscribes an errored effect up to 10 times)". That row's symptom, "Setting the spreadsheet id … again has no visible effect", is also inaccurate:

- `spreadsheetId`, `categoriesSheetId`, `upsertDataSheet` and `storeCategories` are all handled by the reducer, so the in-session state still changes.
- What stops is the localStorage write, which becomes visible only after a reload.

That file is outside [AC41]'s list, so this is a note with the same fix direction (RR-N3).

### RR-7 N6 and remaining citations

**The four N6 rewrites, checked against the code:**

- **`delete-expense.md:71-75` — true.**
  - `deleteExpense$`'s `catchError` (:289) sits inside `exhaustMap` (:265).
  - On failure it logs (:290) and, when a backup exists, rolls back (:300-318, `storeExpenses` with the restored array).
  - It dispatches `loading(false)` and `operationFailed`, which opens the toast.
  - The effect keeps responding afterwards.
  - With no backup (:293-298) there was no optimistic removal to undo.
- **`load-expenses.md:81-84` — true.** `catchError(reportFailure('loadExpenses$', …))` at :335 sits inside :330.
- **`manage-categories.md:59-62` — true.** `updateCategoryPosition$`'s `catchError` at :167 sits inside :161.
- **`troubleshooting.md`:**
  - `:50`: the `catchError` placement is true, but the resubscription parenthetical and the symptom wording are not (RR-N3).
  - `:64-66`: "fully silent … no toast … the log overlay is the only place" is accurate for the persist effects and the setup pipeline. The setup `catchError` (`setup-page.container.ts:79-82`) logs and clears `loading`, and shows no toast.
- None of the four files cites a known-issue number any more.

**N6: resolved** for its four files.

**Remaining citations of nonexistent known-issue numbers.** `known-issues.md` holds entries 2, 3, 11, 13, 23, 24, 25, 26 and 27. Excluding `log.md`, which is history:

- **`knowledge/interfaces/ngrx-actions.md:89` — "item 20".**
  - Pre-existing (baseline :86).
  - The surrounding sentence at :87-88, "still have **no** failure path at all — `LocalStorageService.put` throwing is still fully uncaught", is also false: the outer `catchError` at `app.effects.ts:46,61,78,92` catches and logs.
  - It uses "still" narration and contradicts `state-management.md:161-167`.
  - `ngrx-actions.md` is an [AC41] concept, but this sentence is outside its Outbox scope and outside the slice diff (RR-N2).
- **`knowledge/operations/troubleshooting.md:32` — "items 20 and 9".** Pre-existing (baseline :32) (RR-N2).
- **Valid in-table references:** `known-issues.md:28` (item 2) and `:30` (item 23).

**`troubleshooting.md:30-32,41` — "the setup pipeline has no `catchError`": confirmed false, pre-existing.**

- `src/modules/setup/setup-page/setup-page.container.ts:79-82` is `catchError((e) => { log(e); this.loading = false; return EMPTY; })`.
- Both statements are present at `4f801b2` (:31, :41), outside [AC41]'s list, and not introduced by this change (RR-N2).

### RR-8 Regression sweep

| Item | Verdict | Evidence |
|---|---|---|
| [AC7] | **not met** (re-open) | Root binding, type-only imports and `implements` unchanged. The D11 "emits once (or errors)" contract fails on the synchronous-throw path (RR-3, RR-9 item 1). |
| [AC8] | confirmed | RR-3 clause list |
| [AC9] | confirmed | `in-memory-outbox-storage.ts` and `src/services/index.ts` last modified 2026-09-12T23:32, before REVIEW-1; REVIEW-1 §2 evidence stands |
| [AC15], [AC17], [AC18] | confirmed | RR-2 |
| [AC16], §3.1 | **met** | RR-2 |
| [AC21] | holds as specified | Its failure toast depends on storage erroring. RR-9 item 1 restores that for a closed connection. |
| [AC32], [AC34], [AC35] | confirmed | `git diff --quiet 4f801b2` clean, zero untracked: dashboard, security, interceptors, constants, `ngsw-config.json`, `angular.json`, `package.json`, `package-lock.json`, `policy/` |
| [AC33] | confirmed | `spreadsheet.service.ts` still has one hunk, `@@ -36,0 +37,4 @@` (the accessor); `expense-row.ts` and `spreadsheet.service.spec.ts` clean against `4f801b2` |
| [AC36] | confirmed | RR-2 md5 table; setup and guards clean |
| [AC37] | confirmed | The only added line matching a storage name is the `app.effects.ts:23` import, which already carried `LocalStorageService` at baseline. `src/constants` and `src/services/storage` are clean. |
| [AC38] | confirmed | `git diff --stat -- '*.spec.ts'` empty; still `1 skipped` file |
| [AC39] | confirmed | Harness green. No `: any`, `<any>`, `as any`, `any[]` or `eslint-disable` in the 3 changed production files or the 3 changed spec files. |
| [AC44] | confirmed (N10 stands) | `CLAUDE.md` untouched (last modified 2026-09-12T23:45:59). The `:83-91` claims are independent of settle semantics: IndexedDB `exp-spsh-outbox`, two slices and two effects classes, survives logout, DevTools reset, Web Lock `exp-spsh-outbox-drain`. |
| §5.1 | confirmed | The fix adds no logging. `withStore` errors are `DOMException`/`Error` values, the captured identity is a spreadsheet id plus a timestamp, and `lastError` is still `toMessage(e)` (:228). |
| §6.1 | **not met** (re-open) | Commit-time aborts now surface (RR-3). A hang on a closed connection is neither surfaced nor deliberately silent (RR-9 item 1). |
| §6.4 | confirmed | N1 unreachable (RR-3) |
| §6b | confirmed not done | Over the 3 changed production files: no `setTimeout`, `setInterval`, `interval(`, `timer(`, `delay(`, `retryWhen`, RxJS `retry(`, `timeout(`, `timeoutWith`, `BroadcastChannel`, `SyncManager`, `periodicSync`, `.sync.register`, `moveDimension`, or new `disabled`. `DB_VERSION = 1` and a single `indexedDB.open` are unchanged. There is no new `FAILURE_MESSAGES` use. The `storeExpenses` hits are the byte-identical baseline effects, and the `localId` hits are storage keys only. |

### RR-9 Findings

#### Blocking changes

1. **`withStore` never settles when the transaction cannot be created.**
   - **Severity:** major.
   - **Location:**
     - The defect: `src/services/outbox/indexed-db-outbox-storage.service.ts:94-96`, with `fail` attached only as `open()`'s rejection handler at `:113`.
     - Affected consumers: `src/@state/outbox.effects.ts:128-137` (`persistEnqueue$`), `:303` (drain pass), `:160-162` (`retry$`) and `:182-184` (`discard$`).
   - **What's wrong:** a synchronous throw inside the `.then` fulfilment callback becomes an unhandled rejection. The Observable never emits, errors or completes. The concrete trigger is `db.transaction(...)` throwing `InvalidStateError` on a connection the browser closed, which `dbPromise` still holds because nothing handles `onclose` (N8).
   - **Why it matters:** after site data is cleared, or the backing store fails, while the tab is open:
     - `persistEnqueue$` silently stops. There is no `enqueued` action, no announcement and no toast, and every later offline add is lost on reload.
     - The drain pass hangs holding `running` and the Web Lock, so this tab never drains and other tabs wait behind it.

     This breaks D11's contract and §6.1.
   - **Suggested direction:** send every throw on the transaction-setup path to the same once-only error channel. Consider also resetting `dbPromise` when the connection closes, so the next operation reopens. For tests, add a real-IndexedDB case where creating the transaction throws, and assert that `add` and `getAll` reject rather than time out. For example, spy on `IDBDatabase.prototype.transaction`, or use a closed connection.
   - **Blocks:** [AC7], §6.1.
   - **Owner:** implementer (production code); tester (spec).

2. **`state-management.md` claims NgRx resubscription limits the outer-`catchError` exposure; it does not.**
   - **Severity:** minor.
   - **Location:** `knowledge/architecture/state-management.md:167-169`.
   - **What's wrong:** the outer `catchError` returns `EMPTY`, so the effect completes. `defaultEffectsErrorHandler` (`ngrx-effects.mjs:175-185`) resubscribes only on an error, so it never does here.
   - **Why it matters:** [AC41] requires the concept's claims to match the code. R-5 was raised for exactly this reading, that these effects partly survive a throw.
   - **Suggested direction:** state that after the first caught throw the effect stays completed for the rest of the session, with no resubscription. Make the same correction at `knowledge/operations/troubleshooting.md:50` (RR-N3).
   - **Blocks:** [AC41].
   - **Owner:** implementer (docs).

#### Non-blocking notes (new in Re-review 1)

- **RR-N1 (nit): comparative phrasing added by the slice.**
  - Locations: `write-outbox.md:114,121,123,220-221`; `ngrx-actions.md:113-114`; `dependency-wiring.md:60`; `testing.md:77`.
  - "unchanged", "unmodified", "no new … was added", "pre-existing" and "stays untouched" describe the change rather than the system. The bundle's own convention at `log.md:127-132` treats such phrasing as history.
  - Suggested direction: restate them in the same docs pass as item 2.
- **RR-N2 (pre-existing): untrue or narrated statements that predate the slice.**
  - The lines:
    - `state-management.md:200`: "now dynamically imported … rather than"
    - `add-expense.md:43-44`: "used to … no longer"
    - `ngrx-actions.md:87-89`: "still … fully uncaught", item 20
    - `troubleshooting.md:30-32,41`: "setup pipeline has no `catchError`", items 20 and 9
  - All are present at `4f801b2` and outside the slice diff.
  - Two of them now contradict the slice's corrected `state-management.md`, so they are cheap to fix alongside item 2.
- **RR-N3 (minor): `troubleshooting.md:50` misdescribes the symptom and its cause.**
  - It repeats the resubscription parenthetical from item 2.
  - "has no visible effect" is inaccurate: the reducer still applies the action in-session. Only persistence stops, which shows up after a reload.
- **RR-N4 ([AC49], human check): badge contrast.**
  - The `warn` badge has white 9 px text on `#f44336` at about 3.68:1 (below 4.5:1), and its fill is about 1.99:1 against the toolbar.
  - The `accent` badge's text is about 12.0:1, and its fill about 5.25:1.
  - D12 fixes these colours and the counts are in the accessible name, so this is for the human [AC49] run rather than a code change here.
- **RR-N5 (nit): `Date.now` spy cleanup.** `app.effects.add-expense.spec.ts:344,370` restores the spy only on the passing path. A failing assertion would leave `Date.now` mocked for later tests in that file.

#### Carried forward from REVIEW-1

| Note | Status |
|---|---|
| N1 | unreachable after R-2 (RR-3); defensive guard optional |
| N2, N3, N4, N7, N9, N10, N11, N12 | unchanged and still relevant |
| N5 | closed by Oleg's 2026-09-13 decision: `{date}` = `enqueuedAt` |
| N6 | resolved for its four files (RR-7); remaining stale citations are RR-N2 |
| N8 | escalated: the missing `onclose` handling is now the trigger for blocking item 1 |

### RR-10 Per-item verdicts (Re-review 1)

| Item | REVIEW-1 | Re-review 1 |
|---|---|---|
| R-1 | required | **fixed** (RR-2) |
| R-2 | required | **fixed** for transaction abort and error (RR-3); new blocking item 1 on the setup path |
| R-3 | required | **fixed** (RR-4) |
| R-4 | required | **fixed** (RR-5) |
| R-5 | required | **partly fixed**: blocking item 2 (RR-6) |
| N6 | note | **resolved** (RR-7) |
| [AC7] | confirmed | **not met**: re-open (RR-3, item 1) |
| [AC8] | confirmed | confirmed (RR-3) |
| [AC15], [AC17], [AC18], [AC36] | confirmed | confirmed (RR-2) |
| [AC16] | not met | **met** (RR-2) |
| [AC29] | confirmed pending contrast | **met** (RR-4) |
| [AC40] | not met | **met**, with RR-N1 (RR-5) |
| [AC41] | not met | **not met** (item 2; RR-5, RR-6) |
| [AC9], [AC33], [AC37], [AC38], [AC39], [AC44] | confirmed | confirmed (RR-8) |
| §3.1 | not met | **met** (RR-2) |
| §5.1 | confirmed | confirmed (RR-8) |
| §6.1 | not met | **not met** (item 1; RR-3) |
| §6.4 | confirmed | confirmed; N1 unreachable (RR-3) |
| §6b | confirmed not done | confirmed not done (RR-8) |

### RR-11 What I checked (Re-review 1)

- **Commands:**
  - `bash scripts/harness.sh --all` once (green), `npm run lint` (exit 0), `npx tsc -b tsconfig.app.json tsconfig.spec.json` (exit 0).
  - Inventory: `git status --porcelain`, `git diff --stat`, `git diff --stat -- '*.spec.ts'` (empty).
  - Diffs: `git diff -U0` hunk headers for `app.effects.ts` and `spreadsheet.service.ts`; full `git diff` for `app.effects.ts` and the 11 modified knowledge files.
  - Baseline comparisons: `git diff --quiet 4f801b2` plus an untracked-file check over 20 stays-unchanged paths; `git show 4f801b2:` for the narration and citation baselines and the [AC36] md5 comparison.
  - File modification times compared with REVIEW-1's.
- **Code read:**
  - `app.effects.ts:1-360`.
  - `indexed-db-outbox-storage.service.ts` and `outbox-status.component.ts` in full.
  - The `setup-page.container.ts` `catchError`.
  - The `outbox.effects.ts` storage call sites.
- **Tests read:** `app.effects.add-expense.spec.ts:1-80` and `:280-372`, plus `indexed-db-outbox-storage.service.spec.ts` and `outbox-status.component.spec.ts` in full.
- **Theme and framework:**
  - `deeppurple-amber.css`: icon-button, icon, badge and toolbar variables, and the absence of `--mat-sys-on-surface-variant`.
  - Angular Material styles and host bindings in `_icon-button-chunk.mjs`, `toolbar.mjs` and `icon.mjs`.
  - `src/styles.scss`.
  - NgRx's `defaultEffectsErrorHandler`.
- **Docs:**
  - The spec's D11, D12 and [AC28]–[AC43]; the DoD in full.
  - `knowledge/architecture/write-outbox.md`, `state-management.md`, `troubleshooting.md` and `known-issues.md` in full; `ngrx-actions.md:70-114`; `log.md:122-135`; `CLAUDE.md:74-103`.
  - The narration and citation greps above.
- **Pre-fix `withStore`:** I searched `.angular`, `tmp`, `coverage` and the node caches. The only compiled copy is the rebuilt harness output, so the pre-fix body can't be recovered.

I modified nothing except this review file.
