# Write outbox draining on `online$` — architecture

## Context

This is P2 #8 from `docs/backend-less-assessment.md` §5 ("Writes have no offline story") and
"The through-line": today `NetworkStatusService.online$` gates **reads** (`AppEffects.whenOnline`,
`src/@state/app.effects.ts:30-34,268`) but writes simply attempt and fail —
`knowledge/flows/offline-and-updates.md` states the asymmetry plainly: "reads queue, writes do
not." For a household expense tracker the failure mode that matters most is standing at a till
with poor signal and having "Add expense" silently fail. This note locks a **minimal** write
outbox: queue `addExpense` while offline or on a connectivity failure, persist it in IndexedDB,
and drain it serially the next time `online$` goes true. Per the human's explicit instruction,
this slice does **not** include P0 #1 (id column + id-based delete) or P1 #5 (single read path +
local cache) — several of the limitations below exist only because those two are deferred, and
are called out as such rather than silently worked around.

The existing error-surfacing slice (`docs/architecture/effect-error-surfacing.md`,
`docs/specs/effect-error-surfacing.md`) has landed: `AppActions.operationFailed`,
`AppState.lastError`, `src/@state/report-failure.ts` (`reportFailure` + `FAILURE_MESSAGES`), and
`AppEffects.showFailureToast$` (`src/@state/app.effects.ts:280-289`) all exist in the code today
and are reused here, not re-derived.

## Existing patterns to follow

- **State slice file split**: `src/@state/app.{actions,model,reducers,selectors,effects}.ts`,
  re-exported from `src/@state/index.ts:1-5`. The new `outbox` slice mirrors this exact split —
  `outbox.actions.ts`, `outbox.model.ts`, `outbox.reducers.ts`, `outbox.selectors.ts`,
  `outbox.effects.ts` — rather than folding outbox concerns into the `app` files.
- **Action group shape**: `createActionGroup` with `props<>()` per event under `//` section
  comments (`src/@state/app.actions.ts:4-33`).
- **Entity adapter usage**: `sheetsAdapter = createEntityAdapter<Sheet>({ selectId: (e) =>
  e.title })` (`src/@state/app.reducers.ts:12`) is the only precedent for `EntityState` in this
  codebase; the outbox slice's adapter follows the same one-line `createEntityAdapter` shape,
  keyed by a client-generated id, with a `sortComparer` added (no precedent for `sortComparer`
  yet, but it is a standard `@ngrx/entity` option, not a new dependency).
- **Selector shape**: flat `createSelector(selectAppFeature, (state) => state.field)`
  (`src/@state/app.selectors.ts:9-12`), entity-adapter selectors composed the same way
  `sheetsSelector`/`currentSheetSelector` are (`app.selectors.ts:15-24`).
- **Effect shape**: `tap(log)` → `exhaustMap`/`switchMap` over a service call → terminate in a
  `store*` action → `catchError` (`app.effects.ts:96-109`, the canonical "simple remote effect").
  `reportFailure(source, store)` (`src/@state/report-failure.ts:26-33`) is the existing shared
  `catchError` helper and is reused for every terminal (non-retryable) outbox failure.
- **`whenOnline` gate**: `src/@state/app.effects.ts:30-34` — `this.status.online$.pipe(filter(Boolean), map(() => arg))`.
  The drain trigger in this design is the direct analogue for writes.
- **Storage abstraction precedent, and its limit**: `StorageService`
  (`src/services/storage/interfaces/storage.ts`) is an injectable abstract class swapped via
  `{ provide: StorageService, useClass: LocalStorageService }` (`src/app/app.config.ts:54`).
  That pattern (DI token as an abstract class) is followed for the new outbox storage
  abstraction, but the interface itself is **not** reused — `StorageService.get`/`put` are
  synchronous, matching `localStorage`, and IndexedDB has no synchronous surface. Reusing that
  interface would force a fake-sync wrapper; a new, async-shaped abstract class is used instead.
- **DI-swappable security service precedent**: `{ provide: AbstractSecurityService, useClass:
  RedirectSecurityService }` (`app.config.ts:51`) is the same "abstract class + `useClass`"
  pattern the outbox storage abstraction follows.
- **`ROOT_EFFECTS_INIT`**: `@ngrx/effects` (already a dependency) dispatches this action once,
  after all root effects have initialized. No precedent for it in this codebase, but it needs no
  new package and is the standard NgRx mechanism for "run something once at boot from an
  effect" — used here for outbox hydration instead of inventing a bespoke init action.
- **Toolbar status indicator precedent**: `AppComponent` already renders a connectivity class and
  an update-available badge (`knowledge/flows/offline-and-updates.md` "Detecting connectivity",
  "Update delivery" steps 2-3; `src/app/app.component.ts`). The pending-outbox-count indicator
  follows that same slot/pattern rather than inventing a new one in the dashboard.
- **Effects test pattern**: `src/@state/app.effects.spec.ts` is the only effects-test precedent
  in the repo (`[AC16]`, header comment at lines 15-28) — `provideMockActions`, a stubbed
  `Store` keyed by selector *reference*, a controllable `NetworkStatusService.online$`. New
  `outbox.effects.spec.ts` follows the same shape.

## Decisions

| # | Decision | Alternatives considered | Why this |
|---|---|---|---|
| 1 | **Only `addExpense` is queued.** `deleteExpense`, `deleteCategory`, `updateCategoryPosition`, `addCategory`, and all setup/sheet-creation calls are left failing exactly as today. | Queue everything; queue all "append-shaped" writes (`addExpense` + `addCategory`) | See per-mutation table below — every other mutation is either positional/index-based (replay-unsafe once anything else has changed) or a low-frequency admin operation outside the "till, poor signal" use case this item targets. Keeps a P2/effort-M change small and correct rather than broad and fragile. |
| 2 | **`addExpense` failures are classified into `pending` (auto-retry) vs `failed` (terminal), not into "safe" vs "ambiguous, needs confirmation."** Connectivity-shaped errors (`HttpErrorResponse.status === 0`, 5xx, 429) → `pending`, retried automatically on the next `online$` transition. Non-connectivity 4xx (400/403/404) → `failed`, terminal, surfaced via the existing snackbar. | Gate every `status:0` outcome behind manual user confirmation before retrying | A poor-signal connection produces `status: 0` constantly and is exactly the case this feature exists for — requiring a manual confirm on every blip defeats the point. The genuinely dangerous case (request reached Google, was applied, but the response was lost) is indistinguishable from an everyday dropped socket at the client, so it is accepted as a documented residual risk (see Data / Open questions) rather than defended against with a UX gate that would break the common case. |
| 3 | **Duplicate-add residual risk is accepted, not solved.** At-least-once delivery for `addExpense`; true at-most-once needs a server-side idempotency key, i.e. P0 #1's id column, which is explicitly out of scope. | Client-generated dedupe key written into a spreadsheet cell | Would touch the sheet column layout (a schema decision explicitly reserved for #1) and duplicate that item's work; not attempted piecemeal here. |
| 4 | **Proactive short-circuit when already known-offline.** If `online$`'s current value is `false` at the moment `addExpense` is dispatched, skip the network call entirely and enqueue directly as `pending` — do not attempt-then-fail. | Always attempt the call and let it fail into the same `catchError` path | Avoids an HTTP round trip (and the auth interceptor's `refreshToken()` call, `src/http-interceptors/auth-interceptor.ts:19-23`, which itself needs network) that is certain to fail, and avoids a different/confusing error shape from that layer. |
| 5 | **Persistence: raw IndexedDB, no library.** DB `exp-spsh-outbox`, version `1`, one object store `writes`, keyed by a client-generated `localId` (`crypto.randomUUID()`), used only for outbox bookkeeping and never written to the sheet. | `idb`/`dexie` (denied — `policy/sprint-window.json` blocks `package.json` writes); `localStorage` via existing `StorageService` (synchronous, and every write serializes/deserializes the *entire* value under a key — workable for four small settings, not for a growing append-only queue) | IndexedDB is a browser API needing no new dependency, and is the only web-platform-native store suited to structured, growing, queryable records. |
| 6 | **New abstract storage class, not the existing `StorageService`.** `OutboxStorage` (new, async: returns `Observable`/`Promise`), with `IndexedDbOutboxStorage` (real) and `InMemoryOutboxStorage` (test double, and see #7 for its one production role). | Extend `StorageService` with async variants | `StorageService.get`/`put` (`src/services/storage/interfaces/storage.ts:4-9`) is a synchronous contract other code relies on; changing its shape or bolting on async methods blurs one abstraction into two unrelated storage models. A separate abstraction is the smaller, honest diff. |
| 7 | **If IndexedDB is unavailable, don't queue at all — fall back to today's behaviour.** A cheap synchronous capability probe (`typeof indexedDB !== 'undefined'`) gates whether `addExpense$` ever enters the outbox path. If unavailable, `addExpense` behaves exactly as it does today (attempt, and fail loudly via `reportFailure` if actually offline). | Fall back to an in-memory-only queue with a visible warning | An in-memory queue is silently lost on tab close/refresh — a false promise of durability that is worse than today's honest, visible failure. `InMemoryOutboxStorage` still exists, but only as a test double (Testing implications), never wired into `app.config.ts`. |
| 8 | **New feature slice `outbox`, entity-adapter keyed by `localId`, added as a second key on the existing root reducer map.** Not folded into `AppState`. | Add `pendingWrites: OutboxRecord[]` as a field on `AppState` | `AppState` already carries five unrelated concerns (setup, categories, expenses, sheets, errors); the outbox is a genuinely separate bounded concept (its own lifecycle: hydrate, enqueue, drain, retry, discard) and following the `app.*` file-split pattern for it, rather than growing `app.model.ts` again, keeps the diff and the mental model smaller. |
| 9 | **Hydration is async, via `ROOT_EFFECTS_INIT`, never synchronous in `initialState`.** `outbox.reducers.ts`'s `initialState` is always an empty adapter state (`draining: false`); a new `OutboxEffects.hydrateOnInit$` effect reads all persisted records once at boot and dispatches `OutboxActions.hydrated({ records })`. | Read IndexedDB synchronously into `initialState`, like `app.reducers.ts:18-21` does for `LocalStorageService` | IndexedDB has no synchronous API — this isn't a style choice, it's a platform constraint. The existing precedent for "state that can't be ready at `initialState` time" is `expenses`, which starts empty and is filled by a later dispatch (`knowledge/architecture/state-management.md`, "Hydration from localStorage" — "`expenses` is never persisted; it is always re-fetched"); outbox hydration follows that same shape instead. |
| 10 | **Drain trigger, ordering, and concurrency.** Trigger = every `online$` transition to `true` (including the first emission at boot if already online, via `ROOT_EFFECTS_INIT` → hydrate → drain-if-online). Draining is strict FIFO by `enqueuedAt`, one request in flight at a time (serial, not parallel), single-flight across triggers (`exhaustMap` on the trigger stream). On the first connectivity-classed failure encountered mid-drain, the whole drain loop stops (remaining items stay queued) rather than skipping ahead. | Parallel draining; skip-and-continue past a failed item | `addExpense` always inserts at sheet row 0 (`src/services/spreadsheet/spreadsheet.service.ts:270-287`, "newest-first" per `knowledge/constraints/technical-constraints.md`), so replay order **is** the resulting visible order — out-of-order or parallel draining would scramble which expense ends up on top. Stopping (not skipping) on failure also means one bad connection doesn't reorder later items ahead of an earlier one that hasn't gone out yet. |
| 11 | **No timer-based retry/backoff.** The only retry signal is the next `online$` transition to `true`. | Exponential backoff while nominally online but still erroring (e.g. sustained 429) | Keeps the "minimum that ships safely" small; `online$`'s flip-to-true events are already a natural, zero-code backoff for the common case (device regains signal). Sustained-429-while-online is rare enough for a household's write volume to defer (Open questions). |
| 12 | **Terminal (`failed`) items are surfaced through the existing error-surfacing mechanism, with retry/discard as new dispatchable actions.** `OutboxActions.retry({ localId })` / `OutboxActions.discard({ localId })`; v1's UI surface for them is the existing snackbar's action slot (`MatSnackBar.open(message, actionLabel, ...)`, `app.effects.ts:284-286`), not a new "review your queue" screen. | Build a dedicated outbox-review list/panel | A full review UI is real product/UI work outside a P2 architecture-locking note's minimum; the actions and selectors this needs are specified now so a future UI can be added without a state-shape change (see Deferred). |
| 13 | **List/UI integration: a pending-count indicator, not an optimistic list entry.** A `pendingCountSelector` feeds a toolbar badge (same slot as the existing `hasUpdates` badge, `knowledge/flows/offline-and-updates.md` "Update delivery" step 3). The queued expense is **not** inserted into `AppState.expenses`. | Optimistically prepend the queued expense into the expenses list | `addExpense$` today has **no** optimistic insertion at all — on success it re-dispatches `loadExpenses` to reload from Google (`app.effects.ts:186-193`) rather than splicing the new expense into the store locally. Introducing optimistic-list-insertion only for the offline path, while the online path still doesn't do it, would be an inconsistent, one-off UI behaviour; a count badge needs no new list-rendering logic and matches an existing precedent. |
| 14 | **One reload on drain-empty, not one per drained item.** When the outbox transitions from non-empty to empty, dispatch `AppActions.loadExpenses` once for the currently selected sheet, only if the app is still on the dashboard with a sheet selected. | Reload after every successfully drained item | Matches the existing `addExpense$` reload-after-success shape (one reload per add, online) as closely as possible while avoiding N reads for N queued items — cheap, since gviz reads are otherwise already a per-interaction cost per §2 of the assessment. |
| 15 | **New effects class `OutboxEffects`, registered alongside `AppEffects`.** `EffectsModule.forRoot([AppEffects, OutboxEffects])` in `app.config.ts:65` (array form, currently a single class). `AppEffects.addExpense$` gets a minimal touch (the online/failure branching); `OutboxEffects` owns hydration, persistence, and the drain loop. | Put everything inside `AppEffects` | Keeps the new, more complex, stateful (single-flight, FIFO) drain logic isolated and independently testable, and keeps the touch to the large, already-dense `AppEffects` class to the smallest possible diff in its one existing effect that needs to branch. |
| 16 | **`addExpense$`'s online check uses `withLatestFrom`/`take(1)` on the existing `NetworkStatusService.online$`, not a new synchronous getter.** | Add a synchronous `isOnline: boolean` getter to `NetworkStatusService` | `online$` is backed by a `BehaviorSubject` (`src/services/network-status.service.ts:6`), so `take(1)` on it already yields the current value synchronously-in-effect; no change to `NetworkStatusService`'s public surface is needed. |

### Per-mutation table (why each is or isn't queued)

| Mutation | Sheet write shape | Queued? | Why |
|---|---|---|---|
| `addExpense` | `batchUpdate` insert-row-then-write-cells at row 0 (`spreadsheet.service.ts:270-287`) | **Yes** | Append-shaped (not positional against current state), matches the "till, poor signal" use case directly. |
| `deleteExpense` | Re-read newest 100 rows, `isExpenseEqual` match, delete by **index** (`app.effects.ts:216-222`) | **No — left failing as today** | `knowledge/constraints/known-issues.md` items 2-3: the matched index is only valid against a fresh read taken *at delete time*. Replaying a queued delete after other queued/online writes have changed row order risks deleting the wrong row — worse than today's loud failure + rollback. |
| `deleteCategory` | Array index from `categories.findIndex` used directly as sheet row index (`app.effects.ts:134-140`) | **No — left failing as today** | Same positional fragility as above; "only valid immediately after a fresh load" per the assessment §1. |
| `updateCategoryPosition` (reorder) | Full-range `values.update` overwrite of `categories!A1:B<n>` (`spreadsheet.service.ts:43-50`) | **No — left failing as today** | Replaying a stale full-array overwrite after any intervening edit is a lost-update generator (assessment §6); already has its own rollback + `operationFailed` (`app.effects.ts:163-174`). |
| `addCategory` | `values.append` (`spreadsheet.service.ts:58-69`) | **No — deferred** | Append-shaped like `addExpense` and could be queued with the same pattern later, but adding a second queued mutation type multiplies drain/classification logic for a P2 slice; not needed for the core "add an expense at the till" use case. See Deferred. |
| Setup / sheet creation (`addSheet`, `setDataSheetFormats`, `setCategoriesSheetFormats`, `getSpreadsheet`) | Multi-request `batchUpdate` sequences, run during onboarding | **No — left failing as today** | Low-frequency, admin-shaped, already only reachable while online in practice (setup is not `isOnline`-guarded, which is a pre-existing gap this note does not change); safely replaying a partial multi-step sequence is out of scope. |

## Boundaries

**New:**
- `src/services/outbox/outbox-storage.ts` — abstract class `OutboxStorage` (`getAll(): Observable<OutboxRecord[]>`, `add`, `remove`, `updateStatus`, and a sync `isAvailable(): boolean` capability probe).
- `src/services/outbox/indexed-db-outbox-storage.service.ts` — real implementation, `providedIn: 'root'`, raw `indexedDB.open('exp-spsh-outbox', 1)`, one object store `writes` keyed by `localId`.
- `src/services/outbox/in-memory-outbox-storage.ts` — test double only (see Testing implications); not registered in `app.config.ts`.
- `src/@state/outbox.model.ts` — `OutboxRecord` (`localId`, `kind: 'addExpense'`, `payload: { sheetId: number; expense: Expense }`, `enqueuedAt: number`, `status: 'pending' | 'failed'`, `attempts: number`, `lastError?: string`) and `OutboxState` (`EntityState<OutboxRecord> & { draining: boolean }`).
- `src/@state/outbox.actions.ts` — `OutboxActions`: `hydrated`, `enqueue`, `attemptStarted`, `succeeded`, `retryableFailed`, `terminallyFailed`, `retry`, `discard`, `drainCompleted`.
- `src/@state/outbox.reducers.ts` — entity adapter keyed by `localId`, `sortComparer` on `enqueuedAt`.
- `src/@state/outbox.selectors.ts` — `pendingCountSelector`, `failedItemsSelector`, `isDrainingSelector`.
- `src/@state/outbox.effects.ts` — `OutboxEffects`: `hydrateOnInit$` (`ROOT_EFFECTS_INIT`), `persistEnqueue$` (writes a newly enqueued record to `OutboxStorage`), `drainOnOnline$` (the serial FIFO drain loop described in decision 10).
- One new `FailureSource` member (e.g. `'outboxDrain$'`) and its `FAILURE_MESSAGES` entry in `src/@state/report-failure.ts`, following the existing pattern (`report-failure.ts:7-24`).
- A pending-count badge, placed in `AppComponent`'s toolbar next to the existing connectivity/update indicators (`src/app/app.component.ts` / `.html`) — exact markup is the planner's/implementer's call.

**Touched (minimal diff):**
- `src/@state/app.effects.ts` — `addExpense$` (lines 180-196 today): before calling `spreadSheetService.addExpense`, branch on `this.status.online$` (`take(1)`); if offline, dispatch `OutboxActions.enqueue(...)` instead of calling the service. In `catchError`, classify the error (`HttpErrorResponse.status === 0 | 5xx | 429` → dispatch `OutboxActions.enqueue(...)`/`retryableFailed`; everything else → existing `reportFailure('addExpense$', this.store)`, unchanged).
- `src/app/app.config.ts:65` — `EffectsModule.forRoot(AppEffects)` becomes `EffectsModule.forRoot([AppEffects, OutboxEffects])`.
- `src/@state/index.ts` — barrel exports for the five new `outbox.*` files, alongside the existing `app.*` exports.
- Root `ActionReducerMap` (currently `{ app: AppState }` in `app.reducers.ts:32`) gains an `outbox: OutboxState` key — likely relocated into (or re-exported from) `src/@state/index.ts` so neither `app.reducers.ts` nor `outbox.reducers.ts` has to import the other's map.
- `src/@state/report-failure.ts` — one new `FailureSource` union member and `FAILURE_MESSAGES` entry (see New, above); `reportFailure` itself is unchanged.

**NOT touched (and why):**
- `SpreadsheetService` (`src/services/spreadsheet/spreadsheet.service.ts`) — `addExpense`'s signature, body, and params are unchanged; a replayed request is built and sent exactly the same way as a live one (see Data).
- `src/services/spreadsheet/expense-row.ts` — no column change; the outbox stores the same `Expense` shape the store already carries, nothing sheet-shaped is added.
- `deleteExpense$`, `deleteCategory$`, `updateCategoryPosition$`, `addCategory$`, and every setup effect — logic unchanged per the per-mutation table above.
- `AbstractSecurityService` / `RedirectSecurityService` / `PopupSecurityService` / `ExpAuthInterceptor` — auth/token lifecycle is unchanged; a replayed write goes through `ExpAuthInterceptor.intercept` (`src/http-interceptors/auth-interceptor.ts:13-24`) exactly like any other HTTP call, so a 401 is handled (or not) exactly as it is today.
- `ngsw-config.json` — unchanged; see Integration points.
- `StorageService` / `LocalStorageService` (`src/services/storage/`) — unchanged; the outbox uses the new async `OutboxStorage` abstraction instead (decision 6), and nothing about the four keys `LocalStorageService` already persists changes.
- `NetworkStatusService` — unchanged; no new public surface needed (decision 16).
- The existing error-surfacing mechanism itself (`AppActions.operationFailed`, `AppState.lastError`, `showFailureToast$`) — reused as-is, only fed a new `source`/message.
- `DashboardPageContainer` (`src/modules/dashboard/dashboard/dashboard-page.container.ts`) — `onSubmit` still just dispatches `AppActions.addExpense(...)` (line 113); it does not need to know whether the write went live or into the outbox, that branch lives entirely inside `addExpense$`.

## Data

- **No spreadsheet column layout change.** Nothing here touches `EXPENSE_COLUMNS`
  (`src/services/spreadsheet/expense-row.ts:11`), any `A1:E{n}` range, or the gviz `select`
  clause. No migration story is needed for existing spreadsheets because their shape is
  untouched.
- **No wire-format change against Google APIs.** A replayed `addExpense` call is built from the
  same `{ sheetId, expense }` payload through the same `SpreadsheetService.addExpense` method,
  producing a byte-identical `batchUpdate` request whether sent live or from the drain loop.
- **New client-side persistence.** IndexedDB database `exp-spsh-outbox` (version `1`), one
  object store `writes`, keyed by `localId` (`crypto.randomUUID()`, generated purely for queue
  bookkeeping — never sent to Google, never appears in any sheet). Record shape:
  `{ localId, kind: 'addExpense', payload: { sheetId, expense }, enqueuedAt, status, attempts, lastError? }`.
- **Failure modes of that persistence:**
  - `indexedDB` undefined, or `.open()` throws/`blocked`/`error`s synchronously-detectably at the
    capability-probe stage → outbox is **not entered at all**; `addExpense` behaves exactly as
    today (decision 7). No silent data loss, no false durability promise.
  - A race where the probe passes but the actual write to IDB later fails (quota, a mid-session
    IDB error) → the in-memory NgRx entity for that record stays (best-effort, this session
    only), and `OutboxActions` dispatches a `terminallyFailed`-shaped `operationFailed` warning;
    a reload before it succeeds does lose that one record. Documented as a known, narrow,
    residual gap rather than engineered away (see Open questions).
- **Store shape change.** A new `outbox` feature slice (`OutboxState`, entity-adapter keyed by
  `localId`) is added to the root reducer map. It is **never** part of the four keys
  `LocalStorageService`/`app.reducers.ts:14-23` reads at `initialState` time, and it is **never**
  written to `localStorage` — durability comes exclusively from IndexedDB. `initialState.outbox`
  is always an empty adapter state; real content arrives only via the post-boot
  `OutboxActions.hydrated` dispatch (decision 9), the same treatment `app.reducers.ts` already
  gives `expenses`.
- **Residual duplicate-row risk, stated plainly (decision 2-3):** if a connection drops after
  Google has actually applied an `addExpense` `batchUpdate` but before the HTTP response reaches
  the browser, the outbox will retry it, producing a genuine duplicate row in the sheet. Without
  a server-side identity column (P0 #1, explicitly out of scope here) this cannot be detected or
  prevented client-side. It is accepted, not solved, and should be stated to users (Open
  questions, product owner).

## Integration points

- Same single Google API surface as today: `SpreadsheetService.addExpense`'s existing
  `spreadsheets:batchUpdate` call. No new endpoint, no new OAuth scope, no change to which read
  path (gviz vs `values.get`) anything uses.
- IndexedDB is a browser storage API, not a Google API — no scope or consent-screen implication.
- **Service worker: no Background Sync.** `@angular/service-worker`'s `SwUpdate`/`ngsw` surface
  implements HTTP caching and prefetch, not the Background Sync API — confirmed by the absence
  of any such capability in `ngsw-config.json`'s schema. Draining is **page-driven only**: it
  runs while the app's JS is executing in an open tab, exactly like the rest of this SPA. If the
  tab is closed right after an offline `addExpense`, the record survives (IndexedDB is durable
  across reloads) but will only actually drain the next time the app is opened while online, not
  in the background.
- **`ngsw-config.json` is unchanged.** Its `googleapis` `dataGroups` entry
  (`ngsw-config.json:27-41`) already has `maxAge: "0u"` / `strategy: "freshness"`, and the
  Angular service worker only intercepts `GET` for caching purposes in the first place — the
  outbox's `POST` replay traffic was never something the service worker cached or would need
  reconfiguring for.
- Replayed writes go through `ExpAuthInterceptor` (`src/http-interceptors/auth-interceptor.ts`)
  exactly like a live write; the token refresh/redirect flow is unchanged end to end.

## Conflicts with existing patterns checked

- `.claude/rules/code-style.md`'s "use signals, not other state patterns" governs
  **component-local** state; the outbox is an NgRx feature slice, the same layer `AppState`
  already occupies — no conflict, confirmed by `app.model.ts`/`app.reducers.ts` using plain
  interfaces and `createReducer`, not signals.
- `EffectsModule.forRoot(AppEffects)` currently takes a single class
  (`src/app/app.config.ts:65`); this note deliberately changes that to array form
  (`[AppEffects, OutboxEffects]`) rather than folding the drain logic into `AppEffects` — flagged
  in Boundaries/Decision 15 as a real, intentional deviation from "one effects class today," the
  same kind of deviation the error-surfacing note flagged for `report-failure.ts`'s naming.
- `policy/sprint-window.json` denies `package.json`/`angular.json` writes — respected: no new
  npm dependency anywhere in this design (`crypto.randomUUID()` and `indexedDB` are browser
  APIs; `ROOT_EFFECTS_INIT` ships inside the already-installed `@ngrx/effects`).
- No conflict with `sheetsAdapter`/`Category.id`/`Sheet.id` semantics — the outbox entity
  adapter is a new, independent adapter over `OutboxRecord`, keyed by a queue-only `localId`
  that is never confused with any sheet-domain id.
- `.claude/rules/code-style.md`'s WCAG AA requirement applies to the new toolbar badge and to
  the retry/discard snackbar action — flagged under Open questions, same as the prior
  error-surfacing note flagged snackbar timing.

## Testing implications

- `OutboxStorage` is an injectable abstract class with two implementations: the real
  `IndexedDbOutboxStorage` and an `InMemoryOutboxStorage` test double
  (`src/services/outbox/in-memory-outbox-storage.ts`) — this exists specifically because
  `fake-indexeddb` is **not** installed (confirmed: no `idb`/`dexie`/`fake-indexeddb` in
  `package.json`) and cannot be added under `policy/sprint-window.json`. All reducer/selector/
  effect tests use the in-memory double; no test needs a real IndexedDB.
- `OutboxEffects` tests follow `src/@state/app.effects.spec.ts`'s established pattern
  (`provideMockActions`, a stubbed `Store` keyed by selector reference, a controllable
  `NetworkStatusService.online$` `Subject`, and here also the `InMemoryOutboxStorage` in place of
  `SpreadsheetService`/`OutboxStorage`).
- The FIFO/serial/single-flight drain behaviour (decision 10) is testable the same way
  `deleteExpense$`'s sheet-row-index tests already are in that file: a `Subject`-driven
  `actions$`, queued mock return values keyed by call count, and assertions on call order/count
  rather than marble diagrams.
- A pure classifier function (e.g. `classifyAddExpenseError(e: unknown): 'retryable' |
  'terminal'`, mirroring `toMessage`'s shape) belongs in `src/shared/helpers/index.ts` next to
  `toMessage`/`isExpenseEqual`, and fits directly into the existing `index.spec.ts` file and
  pattern.
- `outbox.reducers.spec.ts` follows `app.reducers.spec.ts`'s existing pattern.
- CLAUDE.md's "never delete or overwrite working tests without explicit permission" and "always
  run `scripts/harness.sh`" apply as-is; nothing here requires touching an existing test file,
  though `app.effects.spec.ts`'s `addExpense$`-adjacent behaviour (none tested today) gains new
  coverage.
- Exact test cases and coverage decisions are the tester's, not this note's.

## Minimum that ships safely

- Proactive enqueue when `online$` is currently `false` at `addExpense` dispatch time.
- Reactive enqueue/retry-marking when a live `addExpense` attempt fails with a connectivity-
  classed error (`status === 0`, 5xx, 429); non-connectivity 4xx still goes through the existing,
  unchanged `reportFailure` path.
- IndexedDB persistence (`exp-spsh-outbox`/`writes`), boot-time async hydration via
  `ROOT_EFFECTS_INIT`, never synchronous, never in `localStorage`.
- Strict FIFO, serial, single-flight drain triggered by `online$` transitions to `true`
  (including at boot if already online), with no timer-based backoff.
- Terminal `failed` state for non-connectivity 4xx encountered mid-drain, surfaced through the
  existing `operationFailed`/`showFailureToast$` mechanism with a new `FailureSource`, and
  `OutboxActions.retry`/`discard` actions wired to that snackbar's action slot.
- A pending-count indicator in the toolbar (existing badge slot), so a queued-offline expense is
  visibly not lost.
- One `loadExpenses` reload when the queue transitions from non-empty to empty, for the
  currently selected sheet only.
- If IndexedDB is unavailable, no queueing occurs at all — behaviour is identical to today.

## Deferred

- P0 #1 (id column + id-based delete) and P1 #5 (single read path + local cache) — explicitly
  excluded by the human's instruction; several limitations above (duplicate-row residual risk,
  no optimistic list entry, gviz/`values.get` split unchanged) exist only because these are
  deferred.
- Queueing `addCategory` (append-shaped, same pattern as `addExpense`, but a second queued
  mutation type is unnecessary complexity for this slice's core use case).
- Queueing or proactively blocking `deleteExpense`, `deleteCategory`, `updateCategoryPosition`,
  or any setup/sheet-creation call — excluded per the per-mutation table; left failing exactly as
  today.
- Timer-based retry/backoff while online but still erroring (e.g. sustained 429).
- A dedicated "review your offline queue" screen — v1 ships pending-count + snackbar-level
  retry/discard only.
- Any `HttpClient` request timeout — none exists today anywhere in `SpreadsheetService`; adding
  one is a pre-existing gap, not introduced here, and is out of scope.
- Proactively disabling delete/reorder UI controls while offline.
- `moveDimension` for category reorder (assessment §6 / P1 #6) and a schema version marker
  (assessment §7 / P1 #7) — unrelated recommendations, not touched by this slice.

## Open questions

- **Duplicate-row residual risk (decision 2-3).** Accepted and documented, not solved. Default:
  ship as-is; note the possibility of an occasional manually-fixable duplicate row somewhere
  user-facing (help text/FAQ). **Owner: product owner** — decide whether this is acceptable for
  release or whether P0 #1 must land first.
- **Pending-count indicator design.** Default proposed: toolbar badge, same slot as the existing
  `hasUpdates` indicator. **Owner: UX owner** to confirm placement/visual treatment.
- **Failed-item review surface.** Default proposed: snackbar-level retry/discard only for v1, no
  dedicated screen. **Owner: product/UX owner**, revisit after observing real-world failure
  rates.
- **No request timeout exists in `SpreadsheetService`/`HttpClient` usage today**, pre-existing
  and unrelated to this slice, but it interacts with it: a hung request never resolves to a
  retryable error, so a queued item mid-attempt could stay "in flight" indefinitely rather than
  falling back to `pending`. Default: out of scope here; track separately. **Owner: engineering
  lead.**
- **Whether to proactively disable delete/reorder controls while offline**, instead of letting
  them fail-and-roll-back as today. Default: no change (decision matches "leave failing as
  today"). **Owner: UX owner**, optional follow-up.
- **IDB schema evolution.** No migration tooling is proposed beyond "start at version 1, keep
  changes additive." Default: treat future outbox schema changes as additive-only, accept that a
  destructive version bump may drop an in-flight queue (rare, and the record set is meant to
  drain quickly rather than persist for months). **Owner: whoever next touches
  `IndexedDbOutboxStorage`.**
- **WCAG AA on the new snackbar action buttons (Retry/Discard) and the toolbar badge** — same
  category of concern the prior error-surfacing note raised for snackbar timing. **Owner:
  UX/accessibility owner.**
- **Other ranked recommendations remain open** (P1 #5 local cache, P1 #6 `moveDimension`, P1 #7
  schema version, P0 #1 id column, P2 #9 `drive.file` scope) — explicitly out of scope for this
  slice, listed here only for completeness per `docs/backend-less-assessment.md`'s ranked table.
  **Owner: whoever scopes the next slice.**
