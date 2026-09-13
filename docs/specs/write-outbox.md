# Write outbox for `addExpense`

## Goal

When there is no network or the connection is bad, `addExpense` goes into a queue stored in IndexedDB instead of failing. The queue is sent in order, one request at a time, once it can be delivered, so an expense entered at the till with poor signal still ends up in the user's spreadsheet. Requested by the repo owner (Oleg) as ranked recommendation P2 #8 of `docs/backend-less-assessment.md` (§5, lines 187-199, and "The through-line", lines 272-281). The design is set by `docs/architecture/write-outbox.md`; every departure from it is recorded under Decisions.

## Scope

**In:**

- A new NgRx slice `outbox`, split into files the same way as `app.*`: `src/@state/outbox.{model,actions,reducers,selectors,effects}.ts`. It is registered next to `app` in the existing root reducer map, and `OutboxEffects` is registered next to `AppEffects`.
- New copy table `src/@state/outbox-messages.ts`.
- New persistence layer under `src/services/outbox/`:
  - abstract class `OutboxStorage`
  - `IndexedDbOutboxStorage`, using raw IndexedDB: database `exp-spsh-outbox`, version 1, object store `writes`
  - `InMemoryOutboxStorage`, a test double that is never wired into the app
  - `OutboxDrainLock`, which wraps the Web Locks API and falls back to running unlocked
- New record type `OutboxRecord` in `src/shared/models/outbox-record.ts`.
- New pure helper `classifyWriteError(e: unknown)` in `src/shared/helpers/index.ts`.
- One read-only accessor added to `SpreadsheetService`: `getSpreadsheetId(): string`. Nothing else in that file changes.
- `AppEffects.addExpense$` (`src/@state/app.effects.ts:180-196`) chooses between the live write and the queue (D5), and `AppEffects` gets one new constructor parameter.
- Two new standalone components:
  - `OutboxStatusComponent`, a toolbar button with a count badge
  - `OutboxFailureNoticeComponent`, a snackbar body with Retry / Discard / Close
- Wiring in `src/app/app.component.{ts,html}` and `src/app/app.config.ts`.
- Tests, all in **new** spec files (D17).
- Updates to `knowledge/` and `CLAUDE.md` (see [AC40]-[AC44]).

**Out (each needs its own spec if wanted):**

- **P0 #1: id column and id-based delete.** No column is added, and nothing about positional addressing changes. Because of this, duplicate rows on replay are possible (D3).
- **P1 #5: one read path plus a local cache.** Also out: inserting queued expenses into the expenses list before they are confirmed. Queued expenses do not appear in the expenses table until they are sent and re-read.
- **Queueing any mutation other than `addExpense`.** Each of these keeps failing exactly as it does today:
  - `deleteExpense`
  - `deleteCategory`
  - `updateCategoryPosition`
  - `addCategory`
  - `loadCategories`
  - setup / sheet creation (`getSpreadsheet`, `addSheet`, `setDataSheetFormats`, `setCategoriesSheetFormats`)
- **Timer-based retry or backoff** of any kind (D6).
- **A queue review screen**, i.e. a list of every queued item. Also out: editing a queued expense.
- **Request timeouts** on `HttpClient` calls. None exist anywhere today, and the risks this causes are listed under Risks.
- **Background Sync** and any drain driven by the service worker. Also out: any `ngsw-config.json` change.
- **P1 #6** `moveDimension` for category reorder, **P1 #7** schema version marker, **P2 #9** `drive.file` + Picker scope.
- **P0 #3** PKCE / CSP hardening, and any other auth or token lifecycle change.
- **Clearing or partitioning the outbox on logout or on a user change.** Doing this would mean touching `AbstractSecurityService.logout` (`src/services/security/abstract-security.service.ts:41-50`).
- **Keeping the store in sync live across tabs** (e.g. `BroadcastChannel`). Tabs only re-sync at drain passes (D8).
- **Disabling delete or reorder controls while offline.**
- **Any change to `showFailureToast$` or to `FAILURE_MESSAGES` / `FailureSource`** (D13).
- **A client-generated dedupe key or at-most-once delivery.**
- **IndexedDB schema migrations beyond version 1.**
- **Fixing the existing loss of a *live* add when an OAuth redirect happens while its request is in flight** (Risks).
- **Un-skipping `src/app/app.component.spec.ts`** (known issue 13).

## Approach

- **The state layer carries the mechanism, and all remote I/O stays in effects.**
  - `OutboxEffects` (new) owns hydration, the persist-first enqueue, the drain loop, and the reactions to Retry/Discard.
  - `AppEffects.addExpense$` changes only in how it routes: live write or queue.
  - No component calls `SpreadsheetService` or `OutboxStorage`.
  - Follow these existing shapes:
    - action group: `src/@state/app.actions.ts:4-33`
    - entity adapter: `src/@state/app.reducers.ts:12`
    - flat selectors: `src/@state/app.selectors.ts:9-24`
    - "simple remote effect": `src/@state/app.effects.ts:96-109`
    - `reportFailure`: `src/@state/report-failure.ts:26-33`
- **Persistence is a new async abstraction, not `StorageService`.** `StorageService` is synchronous (`src/services/storage/interfaces/storage.ts:4-9`). `OutboxStorage` is an abstract class used as its own DI token, the same "abstract class + implementation" idea as `StorageService` / `AbstractSecurityService`. It carries its own root default binding (D11) so that the unmodified `src/@state/app.effects.spec.ts` TestBed can still build `AppEffects`.
- **One network send path.** A replayed write calls the same `SpreadsheetService.addExpense(sheetId, expense)` (`src/services/spreadsheet/spreadsheet.service.ts:270-287`) with the same `sheetId` and the same five `Expense` fields as the live path. That method sends one `:batchUpdate` POST containing `insertDimension` + `updateCells`, which Google applies all-or-nothing (D9).
- **Connectivity** is still defined by `NetworkStatusService.online$` (`src/services/network-status.service.ts:6-12`), read as its current value with `take(1)`, exactly as the note's decision 16 says. **Signed-in** means `AbstractSecurityService.user$` (`abstract-security.service.ts:14,17`) currently holds a user, the same test `isLoggedIn` uses (`src/shared/guards/index.ts:11-25`).
- **UI:**
  - A presentational `OutboxStatusComponent` sits in `AppComponent`'s toolbar, next to the existing avatar/update-badge button (`src/app/app.component.html:9-29`). It is fed by two new values in `pageState$` (`app.component.ts:41-51`).
  - `OutboxFailureNoticeComponent` is opened by `OutboxEffects` through `MatSnackBar.openFromComponent`.
  - Status messages go through CDK `LiveAnnouncer`. `@angular/cdk` is already a dependency (`package.json:18`).
- **The sheet layout is not touched.** No column, range, row index or date-encoding change (Risks, first bullet).

### Algorithms (pseudocode, to disambiguate only)

`addExpense$` routing, run once per `AppActions.addExpense`:

```
usable := storage.isAvailable() AND spreadsheetService.getSpreadsheetId() != ''
if not usable                          -> today's live path, unchanged (loading true, send, reload / reportFailure)
online  := current online$
pending := current pendingCountSelector
if not online                          -> emit enqueue(record(attempts 0), drain: false)
else if pending > 0                    -> emit enqueue(record(attempts 0), drain: true)
else                                   -> live path: loading(true); send
     on success                        -> loadExpenses for the expense's day (unchanged)
     on error, classify:
        retryable | auth               -> emit loading(false), enqueue(record(attempts 1, lastError), drain: false)
        terminal                       -> reportFailure('addExpense$') (unchanged)
```

One drain pass. At most one pass runs per tab; triggers are merged (D6):

```
if not preconditions (D7)              -> end silently (log reason); no storage read, no action
acquire lock 'exp-spsh-outbox-drain'   (waits if another tab holds it; unlocked fallback, D8)
  snapshot := storage.getAll(); dispatch hydrated(snapshot)
  loop:
    snapshot := storage.getAll()                         -- fresh read before every item
    next := oldest record with status 'pending' by (enqueuedAt, localId); none -> break
    if next.localId in sessionSent     -> storage.remove(next); continue
    if not current online$             -> break
    if next.spreadsheetId != spreadsheetService.getSpreadsheetId()
                                       -> storage.updateStatus(failed, otherSpreadsheet); dispatch terminallyFailed; continue
    dispatch attemptStarted; send addExpense(next.payload.sheetId, next.payload.expense)
      success   -> sessionSent += localId; storage.remove; dispatch succeeded; sent++; lastSent := next; continue
      retryable -> storage.updateStatus(pending, attempts+1, lastError); dispatch retryableFailed; break
      auth      -> same as retryable; raise the auth toast once per episode (D3); break
      terminal  -> storage.updateStatus(failed, rejected, attempts+1, lastError); dispatch terminallyFailed; newlyFailed++; continue
    any storage error                  -> log; break
  final := storage.getAll(); dispatch hydrated(final)
  dispatch drainCompleted({ sent, newlyFailed, remainingPending: count pending in final, lastSent })
release lock
if any trigger arrived during this pass -> run exactly one more pass
```

### Files

| File | Action | Role |
|---|---|---|
| `src/shared/models/outbox-record.ts` | **create** | `OutboxRecord` type (D10) |
| `src/shared/models/index.ts` | modify | add the export |
| `src/@state/outbox.model.ts` | **create** | `OutboxState` |
| `src/@state/outbox.actions.ts` | **create** | `OutboxActions` |
| `src/@state/outbox.reducers.ts` | **create** | `outboxAdapter`, `outboxInitialState`, `outboxReducer` |
| `src/@state/outbox.selectors.ts` | **create** | count / oldest-failed / draining selectors |
| `src/@state/outbox.effects.ts` | **create** | `OutboxEffects` |
| `src/@state/outbox-messages.ts` | **create** | `OUTBOX_MESSAGES` copy table |
| `src/@state/app.effects.ts` | modify | `addExpense$` body + one constructor parameter only |
| `src/@state/app.reducers.ts` | modify | `outbox` key in `reducers` (and the map/metaReducer types) only |
| `src/@state/index.ts` | modify | barrel exports for the five `outbox.*` files |
| `src/services/outbox/outbox-storage.ts` | **create** | abstract `OutboxStorage` + root default binding |
| `src/services/outbox/indexed-db-outbox-storage.service.ts` | **create** | real implementation |
| `src/services/outbox/in-memory-outbox-storage.ts` | **create** | test double |
| `src/services/outbox/outbox-drain-lock.service.ts` | **create** | `OutboxDrainLock` |
| `src/services/index.ts` | modify | export `OutboxStorage`, `IndexedDbOutboxStorage`, `OutboxDrainLock` (not the in-memory double) |
| `src/services/spreadsheet/spreadsheet.service.ts` | modify | add `getSpreadsheetId()` only |
| `src/shared/helpers/index.ts` | modify | add `classifyWriteError` |
| `src/shared/components/outbox-status/outbox-status.component.ts` | **create** | toolbar button |
| `src/shared/components/outbox-failure-notice/outbox-failure-notice.component.ts` | **create** | snackbar body |
| `src/app/app.component.ts`, `.html` | modify | render the status component and dispatch `syncRequested` |
| `src/app/app.config.ts` | modify | `EffectsModule.forRoot([AppEffects, OutboxEffects])` only |
| `src/modules/dashboard/dashboard/dashboard-page.container.*` | **not** modified | |
| `src/@state/report-failure.ts` | **not** modified | D13 |
| `knowledge/architecture/write-outbox.md` | **create** | [AC40] |
| `knowledge/…`, `CLAUDE.md` | modify | [AC41]-[AC44] |
| new `*.spec.ts` files (tester) | **create** | listed in D17 |

## Decisions

### D0: Approval and owner defaults

Approved by delegation: Oleg, 2026-09-12, autonomous run requested. The architecture note's open questions that belong to owners get these defaults, recorded here so nobody has to ask:

- **Duplicate-row risk** (note decision 3) is accepted for release.
- **Pending indicator** is a toolbar button (D12).
- **Failed items** are handled with snackbar-level Retry/Discard only (D13).
- **No request timeout** (Out).
- **Delete/reorder controls** are not disabled offline (Out).
- **IDB schema changes** are additive only.
- **Logout** does not clear the outbox (Risks).

### D1: Only `addExpense` is queued

Unchanged from note decision 1 and its per-mutation table. Every other mutation is positional, a full-range overwrite, or setup-shaped, and is named individually under Out.

### D2: Target spreadsheet identity (must-resolve 1)

| | |
|---|---|
| **Verified** | `SpreadsheetService` builds every URL from a private mutable field (`spreadsheet.service.ts:26-29`), set only through `setSpreadsheetId` (`:33-35`). There are two callers: `AppComponent`'s constructor, from the store's first `spreadsheetIdSelector` value (`app.component.ts:67-72`), and setup (`setup-page.container.ts:93`, in lockstep with the store dispatch at `:152`). `sheetId` is a per-spreadsheet gid, so gid `0` exists in every spreadsheet. |
| **Alternatives** | (a) Compare against the store's `spreadsheetIdSelector`. (b) Pass the recorded id into `addExpense` explicitly. (c) Record the id the service is actually using, and compare against that same source. |
| **Choice** | **(c).** Add one read-only accessor `getSpreadsheetId(): string` to `SpreadsheetService`. Capture its value into `OutboxRecord.spreadsheetId` when the record is created. Before every send, the drain compares `record.spreadsheetId` with `getSpreadsheetId()`: <ul><li>If the current id is empty, the precondition is unmet (D7): the record stays `pending` and nothing is sent.</li><li>If it is non-empty and different, the record becomes `failed` with `failure: 'otherSpreadsheet'` and is never sent.</li></ul>`addExpense$` does not queue at all when `getSpreadsheetId()` is empty (D5). The sheet title is **not** captured. |
| **Reason** | The URL comes from the service field, so only (c) checks the thing that decides where the write lands. (a) could disagree with the service during boot: `ROOT_EFFECTS_INIT` hydration is not guaranteed to happen after `AppComponent`'s constructor. (b) would change `addExpense`'s signature, and it would write into a spreadsheet the user has since moved away from, which the brief forbids. The title adds no safety: a gid is unique within a spreadsheet, and a deleted or recreated tab gets a new gid, so Google returns 400 and the record ends `failed`. |
| **Deviation** | The note says `SpreadsheetService` is untouched. The only change is this accessor. `addExpense`'s signature, URL, params and body are untouched ([AC14], [AC33]). |

### D3: Error classification, including 401 (must-resolve 2)

| | |
|---|---|
| **Verified** | `ExpAuthInterceptor` runs `security.refreshToken()` before every request except the token endpoint (`src/http-interceptors/auth-interceptor.ts:13-24`). `RedirectSecurityService.refreshToken` either returns the stored token (`redirect-security.service.ts:62-65`) or POSTs to `oauth2.googleapis.com/token` (`:98-102`). If that POST fails, the original request errors with the **token endpoint's** `HttpErrorResponse` (e.g. 400 `invalid_grant`). With no refresh token it calls `requestCode()` (`:105-111`), which waits for `online$` and then redirects the page, so it never errors. Nothing handles 401 anywhere. |
| **Choice** | New pure helper `classifyWriteError(e: unknown): 'retryable' \| 'auth' \| 'terminal'` in `src/shared/helpers/index.ts`, beside `toMessage`. Rules are checked in order, first match wins: |

| # | Condition | Class |
|---|---|---|
| 1 | `e` is not an `HttpErrorResponse` (string, `Error`, `undefined`, anything else) | `terminal` |
| 2 | `status === 0` (network failure, blocked request, CORS, abort), whatever the URL | `retryable` |
| 3 | `e.url` contains `oauth2.googleapis.com/token` and status is 408, 429 or 500-599 | `retryable` |
| 4 | `e.url` contains `oauth2.googleapis.com/token`, any other status | `auth` |
| 5 | `status === 401` | `auth` |
| 6 | `status` is 408, 429, or 500-599 | `retryable` |
| 7 | anything else: 400, 403, 404, 409, 413, every other 4xx, and non-error statuses such as a 2xx response whose body failed to parse | `terminal` |

What each class does:

- **`retryable`:**
  - Live add: enqueue as `pending`.
  - Drain: keep `pending`, `attempts + 1`, stop the pass.
- **`auth`:**
  - Live add: enqueue as `pending`. The data is kept because a token problem is not a data problem.
  - Drain: keep `pending`, `attempts + 1`, stop the pass. The first auth stop after any send that was not an auth stop dispatches `AppActions.operationFailed({ source: 'outboxDrain$', message: OUTBOX_MESSAGES.authBlocked })`. Later auth stops stay silent until a send succeeds again. This is tracked by a boolean on the effect instance, following the precedent of `categoriesBackUp` / `deletedExpenseBackup`.
  - The token lifecycle is **not** changed.
- **`terminal`:**
  - Live add: `reportFailure('addExpense$', store)`, exactly as today (data lost, toast).
  - Drain: `failed` with `failure: 'rejected'`, and the pass continues with the next item.

Reasons for the edge rows:

- **403 is terminal.** Sheets v4 signals quota with 429, and 403 means lost permission or a disabled API, so retrying won't fix it.
- **The token endpoint is checked by URL before status.** Its 400 is an auth problem, not a bad expense.
- **A 2xx parse failure is terminal, not "applied".** It is vanishingly rare for a JSON API. Treating it as success would need response-shape guessing, and the cost of the conservative choice is at most one duplicate after a manual Retry.

### D4: Enqueue is persist-first

| | |
|---|---|
| **Alternatives** | (a) The note's order: the reducer adds the record, then `persistEnqueue$` writes IDB; if the IDB write fails, the record stays in memory for this session only. (b) Write IDB first, and add to the store only after IDB confirms. |
| **Choice** | **(b).** Actions:<ul><li>`OutboxActions.enqueue({ record, drain })` is an intent, handled only by an effect.</li><li>`OutboxEffects.persistEnqueue$` uses `concatMap`, so no enqueue is ever dropped, and calls `storage.add(record)`.</li><li>On success it emits `OutboxActions.enqueued({ record })`, which the reducer adds, followed by `OutboxActions.drainRequested()` when `drain` is true.</li><li>On failure it runs `reportFailure('addExpense$', store)`: `loading(false)` plus the existing toast, the same visible failure as today. No `enqueued` is dispatched.</li></ul> |
| **Reason** | With (a), a drain can send a record whose IDB `add` hasn't finished yet. The `remove` can then complete before the `add`, leaving a zombie record that gets sent again on the next boot as a **duplicate row**. (b) keeps store ⊆ IDB at all times. It is also the note's own decision-7 principle applied consistently: never promise durability you don't have. |
| **Deviation** | The note's `enqueue` is handled by the reducer; here that role is `enqueued`, and `enqueue` is an intent. |

### D5: Ordering against live adds (must-resolve 4)

| | |
|---|---|
| **Choice** | **Yes, route new adds through the queue.** While `pendingCountSelector > 0`, a new online `addExpense` is enqueued with `drain: true` instead of being sent live. Records with status `failed` are out of the line: they do not count, and they never block. Full routing tree in Approach. |
| **Reason** | `addExpense` inserts at row 0 (`spreadsheet.service.ts:271-279`), so the order things are sent in *is* the order in the sheet. A live send while older items wait would put the newer expense below them. A `failed` item needs a human decision (D13), so letting it block would stall every later add indefinitely. |
| **Consequence** | A reactive enqueue (a live send failed with `retryable`/`auth`) uses `drain: false`. Re-sending straight after a failure would just double the failing request (D6). |

### D6: Drain triggers, and no hot loop (must-resolve 3)

| | |
|---|---|
| **Choice** | A pass starts on any of these triggers: <ul><li>**T1** `OutboxActions.hydrated` dispatched by boot hydration.</li><li>**T2** a rising edge of `online$` (an emission of `true` whose previous emission was `false`).</li><li>**T3** every `Router` `NavigationEnd`.</li><li>**T4** `OutboxActions.drainRequested()`, emitted by a behind-queue enqueue (D5) and by Retry (D13).</li><li>**T5** `OutboxActions.syncRequested()`, emitted when the user activates the toolbar button (D12).</li></ul>At most one pass runs per tab. A trigger that arrives while a pass is running, including while it waits for the lock, is **coalesced**: when the pass ends, exactly one more pass runs, however many triggers arrived during it. |
| **Rejected** | <ul><li>"Drain after every successful live write": in one tab a live write only happens when nothing is pending (D5), so it would never find work.</li><li>Timer backoff: note decision 11, and not needed given T3-T5.</li><li>Draining when `enqueued` is dispatched from a *reactive* failure: it causes an immediate re-failure.</li></ul> |
| **How the "online but failing" case clears** | A live add failed with status 0 while `navigator.onLine` stayed true. The item then sends on the user's next add (T4), next navigation (T3), next tap on the toolbar button (T5), or next app open (T1). |
| **No hot loop** | No trigger is ever emitted *because of* a failure. Every trigger is an external event: boot, the OS network event, a user navigation, a user add/Retry/tap. A pass stops at its first `retryable`/`auth` failure. The coalesced rerun needs a trigger that arrived during the pass. So a failing queue with no new external events makes **exactly one** request per trigger. |

### D7: Drain preconditions (must-resolve 6)

| | |
|---|---|
| **Verified** | `isLoggedIn` = `user$` has a user (`guards/index.ts:11-25`). `isSetupReady` = store `spreadsheetId` and `categoriesSheetId` are set (`:34-40`). The service's spreadsheet id is set in `AppComponent`'s constructor and by setup (D2). Setup ends with `finishSetup()` navigating to the dashboard (`setup-page.container.ts:157-163`). At boot, the router's initial navigation completes after the root component is constructed. |
| **Choice** | All of these must hold when a pass starts, before any storage read or lock:<ul><li>**P1** Boot hydration in this tab has completed successfully ([AC20]).</li><li>**P2** The current value of `online$` is `true`.</li><li>**P3** The current value of `AbstractSecurityService.user$` is defined.</li><li>**P4** `SpreadsheetService.getSpreadsheetId()` is non-empty.</li></ul>Before each send, P2 is checked again, and the record's spreadsheet must match (D2). `categoriesSheetId` is **not** required, because `addExpense` doesn't use it. If a precondition fails, the pass ends silently: a `log()` line, no actions, no storage calls. |
| **What re-triggers once they hold** | <ul><li>P1 → T1 (hydration is itself the trigger).</li><li>P2 → T2.</li><li>P3 and P4 → T3. Login lands on `setup/settings` and setup finishes by navigating to the dashboard. At boot, if hydration beats `AppComponent`'s constructor so that P4 fails at T1, the initial `NavigationEnd` comes later and re-triggers. Either order is covered.</li></ul> |

### D8: Multiple tabs / installed PWA plus a browser tab (must-resolve 5)

| | |
|---|---|
| **Alternatives** | (a) Accept the risk: each tab drains independently. (b) Web Locks in `ifAvailable` mode, where a tab skips if another holds the lock. (c) Web Locks in waiting mode, plus a fresh IDB read before every item. |
| **Choice** | **(c).**<ul><li>`OutboxDrainLock.run(work)` holds an exclusive `navigator.locks.request('exp-spsh-outbox-drain', …)` for the whole pass, in the default waiting mode.</li><li>Inside the lock, every item is chosen from a **fresh `storage.getAll()`** taken immediately before it is sent. An item that another tab already sent (removed) or discarded is never re-sent.</li><li>Each pass dispatches `hydrated(snapshot)` at the start and at the end, so this tab's badge picks up other tabs' changes.</li><li>**Fallback:** if `navigator.locks` is `undefined`, `run` executes the work without a lock and logs once per session.</li></ul> |
| **Reason** | (a) gives two tabs the same queue, which means guaranteed duplicate rows. (b) misses items: tab B enqueues just after tab A's final read, B's trigger is skipped, and B's item waits until some later trigger. With waiting mode, B runs a pass after A and finds whatever is left. The fallback risk is accepted: the targets (current Chromium, Safari ≥ 15.4, Firefox) ship Web Locks in secure contexts, and GitHub Pages and `localhost` are secure. A browser without it gets the single-tab guarantee only. |
| **Extra guard** | The effect keeps a per-session set of `localId`s whose send succeeded. If `storage.remove` fails after a successful send, a later pass retries the removal and never re-sends that id. |

### D9: Atomicity of the replayed request, and the loading flag (must-resolve 7)

| | |
|---|---|
| **Verified: one request** | `addExpense` sends **one** `POST …:batchUpdate` whose body is `{ requests: [{ insertDimension }, { updateCells }] }` (`spreadsheet.service.ts:282-286`). Google's reference for `spreadsheets.batchUpdate` says: "Each request is validated before being applied. If any request is not valid then the entire request will fail and nothing will be applied", and "Requests will be applied in the order they are specified." A blank inserted row without its values cannot happen. The one remaining ambiguity is a batch that was applied but whose response got lost. That is the duplicate-row risk the note accepts (decision 3). |
| **Verified: loading today** | `addExpense$` dispatches `loading(true)` (`app.effects.ts:185`). `loadExpenses$` clears it on success (`:273`), `reportFailure` on failure (`report-failure.ts:29`). The submit button is disabled while `loading` is true (`dashboard-page.container.html:76`). The form resets right after dispatch (`dashboard-page.container.ts:113-118`). |
| **Choice** | <ul><li>The *proactive* queue paths (offline, or behind the queue) never dispatch `loading(true)`.</li><li>The *reactive* path (live send failed with `retryable`/`auth`) dispatches `loading(false)` exactly once, before `enqueue`.</li><li>A drain pass never dispatches `loading` itself. Only the `loadExpenses` reload it may trigger does (D14), through `loadExpenses$`'s existing handling.</li><li>`DashboardPageContainer` is not modified, so what happens after submit is identical: the form resets with date and sheet kept, and the button re-enables once `loading` is false.</li></ul> |
| **Reason** | Dispatching `loading(false)` on the proactive path could clear a `loadExpenses$` spinner that belongs to someone else. Letting a background drain drive the global progress bar would flash it on every navigation (T3). |

### D10: Record and store shape

| | |
|---|---|
| **`OutboxRecord`** (`src/shared/models/outbox-record.ts`) | <ul><li>`localId: string`, from `crypto.randomUUID()`</li><li>`kind: 'addExpense'`</li><li>`spreadsheetId: string`</li><li>`payload: { sheetId: number; expense: Expense }`</li><li>`enqueuedAt: number` (`Date.now()` at routing time)</li><li>`status: 'pending' \| 'failed'`</li><li>`attempts: number`</li><li>`lastError?: string` (from `toMessage(e)`, never a URL)</li><li>`failure?: 'rejected' \| 'otherSpreadsheet'` (set only when `failed`)</li></ul> |
| **Expense trimming** | `payload.expense` holds **only** the five `Expense` keys: `date`, `amount`, `category`, `comment`, `isInDebt` (`src/shared/models/expense.ts:1-7`). The form value that `DashboardPageContainer` dispatches also carries a `sheet` object (`dashboard-page.container.ts:110-113`), and that does not get persisted. `toExpenseCells` reads only those five keys (`expense-row.ts:54-68`), so the request body is unchanged ([AC14]). |
| **`OutboxState`** (`src/@state/outbox.model.ts`) | `EntityState<OutboxRecord> & { draining: boolean }`. |
| **Deviation: model location** | The note puts `OutboxRecord` in `outbox.model.ts`. It moves to `src/shared/models/` because `src/services/outbox/*` needs the type, and no service imports from `src/@state/` today. Services depending on the state layer would invert that. |
| **Deviation: added fields** | `spreadsheetId` (D2) and `failure` (D13) are added to the note's record shape. |
| **Adapter and ordering** | Keyed by `localId`. `sortComparer`: `enqueuedAt` ascending, ties broken by `localId` ascending, so the order is fully deterministic. The drain uses the same comparator. |
| **Registration** | `outbox: outboxReducer` is added to the existing `reducers` map in `app.reducers.ts:32` (and the map / `metaReducers` types). `reducers.app` stays the same function. **Deviation:** the note suggests relocating the map to `index.ts`. It stays put, because `app.reducers.spec.ts:9` imports `reducers.app` from `./app.reducers`. |
| **Barrel-safe names** | The outbox files export `outboxAdapter`, `outboxInitialState`, `outboxReducer`, and selectors prefixed with `outbox`/`pending`/`failed`. Nothing reuses `initialState`, `reducers` or `metaReducers`, which would collide under `export *` in `src/@state/index.ts`. |
| **`hydrated` semantics** | `setAll(records)`, replacing the whole collection. This is safe because store ⊆ IDB (D4), and IndexedDB runs transactions whose scopes overlap in the order they were created, so a boot `getAll` that started before an `add` reports before that add's `enqueued`. |

### D11: Persistence and DI

| | |
|---|---|
| **Storage contract** (`OutboxStorage`) | <ul><li>`isAvailable(): boolean`: synchronous; true only when `indexedDB` **and** `crypto.randomUUID` both exist.</li><li>`getAll(): Observable<OutboxRecord[]>`</li><li>`add(record): Observable<void>`: errors if the `localId` already exists.</li><li>`updateStatus(localId, patch): Observable<void>`: the patch may set `status`, `attempts`, `lastError`, `failure`; the op completes quietly if the record is absent.</li><li>`remove(localId): Observable<void>`: completes quietly if the record is absent.</li></ul>Every Observable is cold, emits once (or errors), and completes. One instance runs its operations **strictly in subscription order**. |
| **IndexedDB** | <ul><li>Raw `indexedDB`, no library.</li><li>Database `exp-spsh-outbox`, version `1`; `onupgradeneeded` creates object store `writes` with `keyPath: 'localId'`.</li><li>The connection opens **lazily**, on the first operation, never in the constructor. On `versionchange` it closes itself, so `deleteDatabase` from tests or DevTools isn't blocked.</li><li>Records are stored by structured clone: **no `JSON.stringify`**, so a `Date` comes back as a `Date`.</li><li>Records whose `kind` isn't `'addExpense'` are left untouched and never sent.</li></ul> |
| **DI binding** | `OutboxStorage` carries a root-level default binding that resolves to `IndexedDbOutboxStorage` (`providedIn: 'root'` on the abstract class). There is no provider line in `app.config.ts`. **No runtime import cycle** is allowed: the implementation files take `OutboxStorage` as a type-only import and use `implements`, not `extends`. The abstract class's decorator is the only place that references the implementation. |
| **Reason** | `AppEffects` needs `isAvailable()`. The unmodified `app.effects.spec.ts` TestBed (`:48-57`) provides no `OutboxStorage`, so a binding only in `app.config.ts` would break three existing suites. A lazy-opening root default resolves in those TestBeds without side effects. With `extends` in both directions, one module would hit the other's class before it is initialised (TDZ) and fail at load time. |
| **Deviation** | The note binds the storage in `app.config.ts` like `StorageService` (`app.config.ts:54`). |
| **If IDB is missing** | Unchanged from note decision 7: when `isAvailable()` is false, `addExpense$` behaves byte-for-byte as today. When the probe passes but `open()` or `getAll()` fails at boot, hydration logs and never dispatches `hydrated`, so P1 never holds and no pass runs. Any `enqueue` then fails its `add`, which falls back to today's visible failure (D4). |

### D12: User feedback when an expense is queued

| | |
|---|---|
| **Alternatives** | (a) Badge only. (b) Badge plus a one-off "saved offline" snackbar. (c) Badge plus a polite live-region announcement. |
| **Choice** | **(c).** No snackbar when an item is queued. |
| **`OutboxStatusComponent`** | Presentational, standalone, OnPush. `input()`s `pending: number` and `failed: number`, and `output()` `activate`.<ul><li>Renders nothing when `pending + failed === 0`.</li><li>Otherwise renders one `mat-icon-button` with an `aria-hidden` icon (`cloud_upload`) and a `matBadge` showing `pending + failed`. Badge colour `warn` when `failed > 0`, `accent` otherwise. The badge content is decorative.</li><li>The button's accessible name (`aria-label`) comes from a `computed()` and contains the counts. The status part is `"{p} expense waiting to be sent"` / `"{p} expenses waiting to be sent"`. When failed > 0 it adds `", {f} couldn't be sent"`; when p = 0 it becomes `"{f} expense couldn't be sent"` / `"{f} expenses couldn't be sent"`. The label is always the status followed by `". Send now"`.</li><li>Class/style bindings only, no `ngClass`.</li></ul>`AppComponent` renders it inside `@if (page.user)` before the avatar button, with `pending`/`failed` from `pageState$`, and dispatches `OutboxActions.syncRequested()` on `activate`. |
| **Announcements** | Through `LiveAnnouncer`, politeness `polite`:<ul><li>On `enqueued`: `OUTBOX_MESSAGES.queued` = "Expense saved on this device. It will be sent to your spreadsheet automatically."</li><li>On `drainCompleted` with `sent > 0` and `remainingPending === 0`: `OUTBOX_MESSAGES.allSent` = "All saved expenses were sent to your spreadsheet."</li></ul> |
| **Reason** | (b) conflicts with `docs/specs/effect-error-surfacing.md` D1: no timed toasts, because of WCAG 2.2.1. A persistent toast after every add at the till is friction, and it would replace a failure toast that is still showing. (c) meets WCAG 4.1.3 (status messages) without an overlay. The button keeps the information visible and gives it a text alternative. Whether sighted users notice the badge is a human-only check ([AC45], [AC49]). |

### D13: Surfacing `failed` items: Retry and Discard

| | |
|---|---|
| **Constraint** | `MatSnackBar.open` has one action slot. `showFailureToast$` (`app.effects.ts:280-289`) uses it for `'Dismiss'` and must not change. `report-failure.spec.ts:20-30` pins `FAILURE_MESSAGES` to exactly its 7 keys with `toEqual`, so adding a key would break an existing test. |
| **Alternatives** | (a) `open()` with a single 'Retry' action, and Discard somewhere else. (b) Add `'outboxDrain$'` to `FailureSource`/`FAILURE_MESSAGES` as the note proposes. (c) A small custom snackbar body opened with `openFromComponent`. |
| **Choice** | **(c)** for failed items, plus a separate copy table for the one auth toast. |
| **The notice** | `OutboxFailureNoticeComponent` (standalone, OnPush, inline template) reads `{ record }` from `MAT_SNACK_BAR_DATA`. It uses Material's `matSnackBarLabel` / `matSnackBarActions` / `matSnackBarAction` directives, with three text buttons **Retry**, **Discard**, **Close**. A button records the choice (`'retry' \| 'discard' \| 'close'`) in a signal on the instance, then dismisses. The label copy is:<ul><li>`rejected`: "Couldn't send a saved expense: {category}, {amount}, {date}. Retry, or discard it?"</li><li>`otherSpreadsheet`: "A saved expense ({category}, {amount}, {date}) belongs to a different spreadsheet from the one you're using now. Retry, or discard it?"</li></ul>`{date}` uses `DatePipe` format `d MMM, HH:mm`. |
| **Opening** | `OutboxEffects` opens it with `{ data: { record }, politeness: 'assertive', verticalPosition: 'top' }` and **no `duration`**, the same configuration as `showFailureToast$`. It is opened for the oldest `failed` record by the `sortComparer`, in two cases: when `drainCompleted` has `newlyFailed > 0`, and on `syncRequested` while at least one `failed` record exists. It does not open automatically at boot; the button's label announces failed items. |
| **Handling the choice** | After `afterDismissed()`, the effect maps the choice:<ul><li>`retry` → `OutboxActions.retry({ localId })`.</li><li>`discard` → `OutboxActions.discard({ localId })`.</li><li>`close`, or no choice (e.g. replaced by another snackbar) → nothing.</li></ul>The effects then do:<ul><li>`retry` → `storage.updateStatus(localId, { status: 'pending', failure: undefined })` → `hydrated(getAll())` → `drainRequested()`.</li><li>`discard` → `storage.remove(localId)` → `hydrated(getAll())`.</li></ul>A retried record keeps its original `enqueuedAt`. |
| **Auth toast** | `OUTBOX_MESSAGES.authBlocked` = "Your saved expenses couldn't be sent because your Google sign-in needs renewing. They're kept on this device." It is dispatched as `AppActions.operationFailed({ source: 'outboxDrain$', message })`. `source` is typed `string` (`app.actions.ts:31`), and the existing `showFailureToast$` displays it without modification. |
| **Deviation** | The note's `FailureSource` addition is dropped (it would break `report-failure.spec.ts`), and so is its use of the plain snackbar action slot. |

### D14: Success path

| | |
|---|---|
| **Choice** | When a pass ends with `drainCompleted.sent > 0`, `OutboxEffects` dispatches **one** `AppActions.loadExpenses({ sheetId, from, to })` for `lastSent`: `sheetId = lastSent.payload.sheetId`, `from = lastSent.payload.expense.date`, `to = from + 1 day`. This mirrors `app.effects.ts:187-190`. It is dispatched only when the router's primary path, without query string, is exactly `/dashboard`. Plus the `allSent` announcement when `remainingPending === 0` (D12). |
| **Deviation** | The note reloads only when the queue goes from non-empty to empty, for the "currently selected sheet". Here it is once per pass that sent anything, for the last sent record's sheet and day. |
| **Reason** | If a pass sends 2 items and then stops on a connectivity failure, those 2 rows really are in the sheet, so the table should show them. That is still at most one read per pass, not per item. The dashboard's displayed sheet lives in the form signal and is never written to the store (`dashboard-page.container.ts:121-124`), so `currentSheetSelector` isn't a reliable "what's on screen". Mirroring the live add's reload window is the closest match to today's behaviour. The `/dashboard` check exists because `StatisticsContainer` renders the same `expenses` state (`statistics.container.ts:43`). |

### D15: Effects classes and registration

| | |
|---|---|
| **`app.config.ts`** | `app.config.ts:65` becomes `EffectsModule.forRoot([AppEffects, OutboxEffects])` (note decision 15). |
| **`AppEffects`** | Gains exactly one constructor parameter, `private readonly outboxStorage: OutboxStorage`, **appended after `snackBar`** (`app.effects.ts:291-297`). This matches the file's constructor style. `addExpense$` is the only effect whose body changes. It must not call `this.store.select(expensesSelector)` or add any field-initialiser `select`: `app.effects.spec.ts:127-143` hands out `expensesSelector` values by call count. |
| **`OutboxEffects`** | New file, `inject()` style per `.claude/rules/code-style.md`. It depends on `Actions`, `Store`, `NetworkStatusService`, `AbstractSecurityService`, `SpreadsheetService`, `OutboxStorage`, `OutboxDrainLock`, `Router`, `MatSnackBar`, `LiveAnnouncer`. Hydration listens for `ROOT_EFFECTS_INIT` from `@ngrx/effects` (note decision 9). Every effect catches its own errors *inside* its inner projection, so a failure never completes the effect stream, the same placement as `app.effects.ts:101-107`. |

### D16: No dependency, no config change

No dependency is added, and `package.json`, `angular.json` and `ngsw-config.json` stay unchanged. Everything used is either a browser API (IndexedDB, Web Locks, `crypto.randomUUID`) or ships in an installed package (`ROOT_EFFECTS_INIT` in `@ngrx/effects`, `LiveAnnouncer` in `@angular/cdk`). So nothing touches the denials at `policy/sprint-window.json:8-11`. No human decision is needed.

### D17: Test placement

| | |
|---|---|
| **Choice** | **No existing `*.spec.ts` file is edited.** New suites go in new files: <ul><li>`src/@state/outbox.reducers.spec.ts`</li><li>`src/@state/outbox.selectors.spec.ts`</li><li>`src/@state/outbox.effects.spec.ts`</li><li>`src/@state/app.effects.add-expense.spec.ts`</li><li>`src/services/outbox/indexed-db-outbox-storage.service.spec.ts`</li><li>`src/services/outbox/outbox-drain-lock.service.spec.ts`</li><li>`src/services/spreadsheet/spreadsheet.service.replay.spec.ts`</li><li>`src/shared/helpers/classify-write-error.spec.ts`</li><li>`src/shared/components/outbox-status/outbox-status.component.spec.ts`</li><li>`src/shared/components/outbox-failure-notice/outbox-failure-notice.component.spec.ts`</li></ul> |
| **Reason** | It makes "existing specs unmodified" checkable with `git diff` ([AC38]). The effects specs use the `app.effects.spec.ts` pattern (`provideMockActions`, a `Store` stub keyed by selector reference, the `globalThis.log` stub; `knowledge/operations/testing.md` "Conventions"), with `InMemoryOutboxStorage` and a pass-through `OutboxDrainLock` stub. The real `IndexedDbOutboxStorage` and `OutboxDrainLock` **are** tested against real IndexedDB and Web Locks, because the runner is headless Chromium (`angular.json:100-108`). |

## Risks

- **Existing user data: sheet layout, row indexes and dates.**
  - **Column layout:** not touched. No column, tab name, `A1:E{n}` range or gviz `select` changes.
  - **Row-index arithmetic:** not touched. `deleteExpense$` / `deleteCategory$` are unchanged.
  - **Date conversion:** not touched. `expense-row.ts` is unchanged. There is one new exposure. A queued expense's `Date` is converted to a serial number **when it is sent**, by `getSerialNumberFromDate` (`expense-row.ts:128-130`), using the timezone offset of that instant under the device's timezone *at send time*. If the device changes timezone between queueing and draining (for example after a flight), the wall-clock time written differs from what was entered. The live path makes the same computation at submit time. Accepted and documented ([AC42]).
  - **Storage:** IDB stores the `Date` by structured clone. Any `JSON.stringify` in the storage path would silently turn it into a string and crash `toExpenseCells` ([AC10] guards this).
- **Duplicate rows (at-least-once delivery).** If Google applied the batch but the response was lost, the item is sent again. The same happens across tabs in browsers without Web Locks, and when `remove` fails in tab A and tab B drains before A retries. Without P0 #1 none of this can be detected. Accepted by D0 and recorded as a known issue ([AC42]).
- **Order in the sheet is "order sent", not "order entered", in three cases:**
  - A retried `failed` record lands above expenses that were sent while it was failed.
  - A second tab whose store is stale (pending count 0) sends live ahead of items another tab queued.
  - Back-dated expenses sort by insertion, as they already do today.
- **No request timeout.** A hung `addExpense` keeps a pass, and the Web Lock, held until the tab is reloaded. Every other tab's pass waits behind it. Nothing is lost, because records stay in IDB. Recorded as a known issue.
- **OAuth redirect during a pass.** `requestCode()` navigates away mid-pass (`redirect-security.service.ts:105-111`). The record is still in IDB and drains on the next load. A **live** add that triggers the redirect is still lost, as it is today, because it is not persisted before sending (Out).
- **Logout does not clear the outbox.** `logout()` clears localStorage only (`abstract-security.service.ts:49`). On a shared device, the next user can see the previous user's queued expense summary in the failure notice (spreadsheet mismatch) and can Discard or Retry it. Accepted by D0, recorded as a known issue, and `CLAUDE.md` explains how to delete the database ([AC44]).
- **Storage eviction.** Safari can evict script-writable storage for sites that are not installed after a period without use. Installed PWAs are not affected. A queue left undrained for weeks in a browser tab can vanish.
- **Breaking existing specs.** These are the specific points to watch:
  - `report-failure.spec.ts:20-30`: exact `FAILURE_MESSAGES` (D13).
  - `app.effects.spec.ts:48-57`: TestBed without `OutboxStorage` (D11).
  - `app.effects.spec.ts:127-143`: the `expensesSelector` call-count queue (D15).
  - `app.reducers.spec.ts:9`: `reducers.app` (D10).
  - `statistics.container.spec.ts`: builds a real store from `reducers`, which gains `outbox`. That is harmless as long as the outbox reducer handles `@@INIT`.
  - Barrel name collisions under `export *` (D10).
- **Import-cycle TDZ.** An abstract class that references its implementation, while the implementation `extends` it, crashes at module load (D11). The build may not catch this; the root-injector test in [AC7] does.
- **NgRx freezes actions and state in dev mode.** Records that arrive through actions are frozen. Storage must clone rather than mutate, and `InMemoryOutboxStorage` must `structuredClone` on the way in and out, so tests catch mutation.
- **Triggering on `NavigationEnd`** costs one IDB `getAll` per navigation once preconditions hold, and two `hydrated` dispatches (visible in the log overlay). This is judged negligible at household scale.
- **Toolbar crowding and discoverability.** Sighted users may miss the badge and enter an expense again. The form reset on submit (`dashboard-page.container.ts:114-118`) is the only thing guarding against a double tap once the queue path completes synchronously. Human-only review: [AC45], [AC49].
- **Write window.** `knowledge/` and `CLAUDE.md` are outside `allowed_write_paths` (`policy/sprint-window.json:5-7`) but not in `denied_write_paths`. `CLAUDE.md`'s rule and the orchestrator's brief require these updates. If a policy gate blocks the write, stop and escalate; do not skip [AC40]-[AC44].

## Acceptance criteria

### State slice

- `[AC1]` `src/shared/models/outbox-record.ts` exports `OutboxRecord` with exactly the fields and types in D10, and `src/shared/models/index.ts` re-exports it. `src/@state/outbox.model.ts` exports `OutboxState` as `EntityState<OutboxRecord> & { draining: boolean }`.
- `[AC2]` `src/@state/outbox.actions.ts` exports `OutboxActions`, a `createActionGroup` with `source: 'Outbox'` and exactly these events:
  - `hydrated({ records })`
  - `enqueue({ record, drain: boolean })`
  - `enqueued({ record })`
  - `drainRequested()`
  - `syncRequested()`
  - `attemptStarted({ localId })`
  - `succeeded({ localId })`
  - `retryableFailed({ localId, attempts, lastError })`
  - `terminallyFailed({ localId, attempts, lastError, failure })`
  - `drainCompleted({ sent, newlyFailed, remainingPending, lastSent: OutboxRecord | null })`
  - `retry({ localId })`
  - `discard({ localId })`
- `[AC3]` `src/@state/outbox.reducers.ts` exports `outboxAdapter` (keyed by `localId`, with the D10 comparator), `outboxInitialState` (empty collection, `draining: false`, a literal that reads nothing from `LocalStorageService` or IndexedDB) and `outboxReducer`. The reducer handles exactly these actions:
  - `hydrated` → `setAll`
  - `enqueued` → `addOne`
  - `attemptStarted` → `draining: true`
  - `succeeded` → `removeOne`
  - `retryableFailed` → updates `attempts`/`lastError`, `status` stays `pending`
  - `terminallyFailed` → `status: 'failed'` plus `attempts`/`lastError`/`failure`
  - `drainCompleted` → `draining: false`

  `enqueue`, `drainRequested`, `syncRequested`, `retry` and `discard` leave state unchanged.
- `[AC4]` `src/@state/outbox.selectors.ts` exports these selectors, built on `createFeatureSelector<OutboxState>('outbox')`:
  - `pendingCountSelector`: counts `status === 'pending'` only
  - `failedCountSelector`
  - `oldestFailedSelector`: first `failed` record in comparator order, or `undefined`
  - `isDrainingSelector`
- `[AC5]` Registration and naming:
  - `reducers` in `src/@state/app.reducers.ts` has keys `app` and `outbox`, and `reducers.app` is behaviourally unchanged.
  - `src/@state/index.ts` re-exports all five `outbox.*` files.
  - `src/app/app.config.ts` differs from today only in `EffectsModule.forRoot([AppEffects, OutboxEffects])` and its import.
  - No exported name collides under the barrel (proven by [AC39] typecheck).
- `[AC6]` `src/@state/outbox.reducers.spec.ts` and `src/@state/outbox.selectors.spec.ts` prove, against the real reducer:
  - Initial state is empty with `draining: false`.
  - `hydrated` replaces the collection, including dropping ids that are no longer present.
  - Records come out in `(enqueuedAt, localId)` order even when added out of order.
  - Each reducer branch in [AC3] does what it says.
  - The input state object is never mutated.
  - `pendingCountSelector` ignores `failed` records.
  - `oldestFailedSelector` picks the earliest failed record.

### Storage and lock

- `[AC7]` `src/services/outbox/outbox-storage.ts` exports abstract `OutboxStorage` with the D11 contract. Injecting `OutboxStorage` from a bare `TestBed` (no providers) yields an `IndexedDbOutboxStorage` without opening a database. Neither implementation file imports `OutboxStorage` as a runtime value (type-only import plus `implements`). Asserted in `src/services/outbox/indexed-db-outbox-storage.service.spec.ts`.
- `[AC8]` `IndexedDbOutboxStorage` uses database `exp-spsh-outbox`, version `1`, store `writes`, `keyPath` `localId`. It opens lazily, closes on `versionchange`, never calls `JSON.stringify`/`JSON.parse`, and runs operations in subscription order. `isAvailable()` returns `typeof indexedDB !== 'undefined' && typeof crypto?.randomUUID === 'function'`.
- `[AC9]` `src/services/outbox/in-memory-outbox-storage.ts` implements the same contract, including completing quietly on absent ids and failing `add` on a duplicate id. It uses `structuredClone` in both directions and is referenced by no production file (`app.config.ts`, effects, components).
- `[AC10]` `src/services/outbox/indexed-db-outbox-storage.service.spec.ts` runs against **real IndexedDB in headless Chromium**, deleting `exp-spsh-outbox` before and after each test. It proves:
  - `add` then `getAll` round-trips a record whose `payload.expense.date` is a `Date` instance with the same `getTime()`.
  - `add` of a duplicate `localId` errors.
  - `updateStatus` patches only the given fields.
  - `remove` and `updateStatus` on an absent id complete without error.
  - `add` immediately followed by `remove` of the same id, both subscribed in the same tick, leaves `getAll` empty.
  - A second, fresh instance sees records written by the first.
- `[AC11]` `src/services/outbox/outbox-drain-lock.service.ts` exports `OutboxDrainLock` (`providedIn: 'root'`) with `run(work)`. It uses an exclusive `navigator.locks` lock named `exp-spsh-outbox-drain` in waiting mode, and the lock is released when the work completes or errors. When `navigator.locks` is unavailable it runs the work directly and logs once. `src/services/outbox/outbox-drain-lock.service.spec.ts` proves with real Web Locks that two overlapping `run`s do not overlap (the second's work starts only after the first's completes) and that an erroring work releases the lock. It also proves the unlocked fallback (e.g. `vi.spyOn(navigator, 'locks', 'get')` returning `undefined`).

### Helper and service

- `[AC12]` `src/shared/helpers/index.ts` exports `classifyWriteError(e: unknown): 'retryable' | 'auth' | 'terminal'` implementing the D3 table, with no `any`. `src/shared/helpers/classify-write-error.spec.ts` has at least one test per row: string, `Error` and `undefined` → terminal; status 0 on a Sheets URL → retryable; status 0 on the token URL → retryable; token URL 400 → auth; token URL 503 → retryable; 401 → auth; 408, 429, 500, 503 → retryable; 400, 403, 404 → terminal; status 200 → terminal.
- `[AC13]` `SpreadsheetService` gains exactly one public method, `getSpreadsheetId(): string`, returning the private field (`''` before any `setSpreadsheetId`). The file's diff is only that addition. `src/services/spreadsheet/spreadsheet.service.replay.spec.ts` asserts `''` initially and the set value afterwards.
- `[AC14]` The same new spec proves the byte-identical replay with `HttpTestingController`. It sends `addExpense(sheetId, formValue)`, where the form value includes an extra `sheet` object and a `Date`, and `addExpense(sheetId, replayed)`, where `replayed` is the five-key trim of that value passed through `structuredClone`. Both requests have equal `method`, `urlWithParams`, and `JSON.stringify(body)`.

### `AppEffects.addExpense$`

- `[AC15]` `addExpense$` implements the D5 routing tree exactly:
  - With `isAvailable()` false **or** `getSpreadsheetId()` empty, it performs today's path. The `SpreadsheetService.addExpense` call, `loading(true)`, the success `loadExpenses` window and `reportFailure('addExpense$')` all match `app.effects.ts:180-196` as of this spec, and it never emits `OutboxActions.enqueue`.
  - Offline → one `enqueue({ drain: false })` and no `SpreadsheetService.addExpense` call.
  - Online with `pendingCountSelector > 0` → one `enqueue({ drain: true })` and no call.
  - Online with 0 pending → a live call.
  - Live error classified `retryable` or `auth` → `loading(false)` then `enqueue({ drain: false })`, with no `operationFailed`.
  - Live error classified `terminal` → `reportFailure('addExpense$')` behaviour and no `enqueue`.
- `[AC16]` The enqueued record has:
  - `localId` from `crypto.randomUUID()` (UUID format)
  - `kind: 'addExpense'`
  - `spreadsheetId` equal to `getSpreadsheetId()` at routing time
  - `payload.sheetId` equal to the action's `sheetId`
  - `payload.expense` with exactly the five `Expense` keys (no `sheet`)
  - `enqueuedAt` a number
  - `status: 'pending'`
  - `attempts` 0 on proactive paths, 1 on the reactive path, where `lastError` equals `toMessage(e)`
- `[AC17]` Loading follows D9: proactive queue paths dispatch no `loading` action at all, and the reactive path dispatches `loading(false)` exactly once.
- `[AC18]` In `src/@state/app.effects.ts`, the only changes are the body of `addExpense$`, the new constructor parameter appended after `snackBar`, and the imports. No new field-initialiser `store.select(...)` is added.
- `[AC19]` `src/@state/app.effects.add-expense.spec.ts` covers every branch in [AC15]-[AC17] with a controllable `online$`, a `Store` stub keyed by selector reference (including `pendingCountSelector`), an `OutboxStorage` stub whose `isAvailable` can be toggled, and a `SpreadsheetService` stub with `getSpreadsheetId`/`addExpense`.

### `OutboxEffects`

- `[AC20]` Hydration:
  - On `ROOT_EFFECTS_INIT`, `OutboxEffects` calls `storage.getAll()` once and dispatches `hydrated({ records })`, which is trigger T1.
  - If `isAvailable()` is false, it does not touch storage.
  - If `getAll` errors, it logs, dispatches nothing, and no pass ever runs in that session (P1).
- `[AC21]` Persist-first enqueue (D4):
  - Processing is `concatMap`-ordered.
  - A successful `add` emits `enqueued`, then `drainRequested` only when `drain` is true, then announces `OUTBOX_MESSAGES.queued` politely.
  - A failed `add` dispatches `loading(false)` and `operationFailed({ source: 'addExpense$', message: FAILURE_MESSAGES.addExpense$ })`, and emits no `enqueued`.
- `[AC22]` Triggers (D6):
  - Each of T1-T5 starts a pass when preconditions hold. The `online$` trigger fires only on false→true, not on the initial `true`.
  - `enqueued` itself is not a trigger.
  - Two or more triggers arriving during a running pass produce exactly one extra pass.
  - A pass whose only send fails `retryable`, with no further triggers, results in exactly one `SpreadsheetService.addExpense` call in total.
- `[AC23]` Preconditions (D7):
  - When any of P1-P4 fails, a trigger results in zero storage calls, zero lock acquisitions, zero `addExpense` calls and zero dispatched actions.
  - After P3/P4 become true, a `NavigationEnd` starts a pass that sends.
- `[AC24]` Pass algorithm, as in the Approach pseudocode:
  - The whole pass runs inside `OutboxDrainLock.run`.
  - `hydrated` is dispatched after the first read and again before `drainCompleted`.
  - Items go strictly FIFO by `(enqueuedAt, localId)`, one `addExpense` in flight at a time: the second call is not made before the first emits.
  - Each item is chosen from a fresh `getAll()`, so a record removed between iterations is not sent.
  - `addExpense` is called with `(record.payload.sheetId, record.payload.expense)`.
  - Success → `remove` + `succeeded`.
  - Spreadsheet mismatch → `updateStatus` failed/`otherSpreadsheet` + `terminallyFailed`, with **no** `addExpense` call, and the pass continues.
  - `retryable`/`auth` → `updateStatus` with `attempts + 1` + `retryableFailed`, the pass stops, and later records are untouched.
  - `terminal` → failed/`rejected` + `terminallyFailed`, and the pass continues.
  - Going offline mid-pass stops it before the next send.
  - A `localId` already sent this session is never sent again, even if `remove` failed.
  - `drainCompleted` carries correct `sent`, `newlyFailed`, `remainingPending` and `lastSent`.
- `[AC25]` Auth toast and copy:
  - `src/@state/outbox-messages.ts` exports `OUTBOX_MESSAGES` with keys `queued`, `allSent` and `authBlocked`, holding the D12/D13 strings verbatim.
  - The first auth stop dispatches `AppActions.operationFailed({ source: 'outboxDrain$', message: OUTBOX_MESSAGES.authBlocked })`.
  - A second consecutive auth stop dispatches none.
  - After a successful send, a later auth stop dispatches it again.
  - `src/@state/report-failure.ts` is unchanged.
- `[AC26]` On `drainCompleted` with `sent > 0`, exactly one `AppActions.loadExpenses({ sheetId: lastSent.payload.sheetId, from: lastSent date, to: date + 1 day })` is dispatched, and only when the router's primary path is `/dashboard`. None is dispatched on `/dashboard/statistics`, `/dashboard/categories`, `/setup/...`, or when `sent === 0`. `OUTBOX_MESSAGES.allSent` is announced only when `sent > 0` and `remainingPending === 0`.
- `[AC27]` Failure notice and Retry/Discard:
  - `snackBar.openFromComponent(OutboxFailureNoticeComponent, config)` is called with `data.record` equal to the oldest failed record. The config has `politeness: 'assertive'` and `verticalPosition: 'top'` and no `duration`.
  - It is opened on `drainCompleted` with `newlyFailed > 0`, and on `syncRequested` while a failed record exists. It is not opened otherwise.
  - Choice `retry` → `retry` → `updateStatus(pending, failure cleared)` → `hydrated` → `drainRequested`.
  - Choice `discard` → `discard` → `remove` → `hydrated`.
  - `close` or no choice → no action.
  - `syncRequested` also starts a pass.
- `[AC28]` `src/@state/outbox.effects.spec.ts` proves [AC20]-[AC27] using `provideMockActions`, `InMemoryOutboxStorage`, a pass-through `OutboxDrainLock` stub, stubs for `NetworkStatusService` (controllable `online$`), `AbstractSecurityService` (`user$`), `SpreadsheetService` (`getSpreadsheetId`/`addExpense` returning controllable `Subject`s), `Router` (`events` `Subject` + `url`), `MatSnackBar` (`open`/`openFromComponent` spies) and `LiveAnnouncer` (`announce` spy). It asserts on call order and count, not marble diagrams, and installs the `globalThis.log` stub.

### UI

- `[AC29]` `src/shared/components/outbox-status/outbox-status.component.ts` meets D12: standalone, OnPush, `input()`/`output()`, a `computed()` label, no `ngClass`/`ngStyle`, not added to `src/shared/components/index.ts`. `src/shared/components/outbox-status/outbox-status.component.spec.ts` proves:
  - Nothing renders at 0/0.
  - The badge text equals `pending + failed`.
  - The exact `aria-label` for (1,0), (3,0), (0,1), (0,2) and (2,1): e.g. `"2 expenses waiting to be sent, 1 couldn't be sent. Send now"` and `"1 expense couldn't be sent. Send now"`.
  - The icon is `aria-hidden`.
  - Clicking emits `activate` once.
- `[AC30]` `src/app/app.component.ts` adds pending and failed counts to `pageState$` from `pendingCountSelector`/`failedCountSelector`, and imports the status component by direct path. `app.component.html` renders it inside `@if (page.user)` before the avatar button, with `(activate)` dispatching `OutboxActions.syncRequested()`. There are no other behavioural changes to `AppComponent`. `src/app/app.component.spec.ts` is unmodified.
- `[AC31]` `src/shared/components/outbox-failure-notice/outbox-failure-notice.component.ts` meets D13. `src/shared/components/outbox-failure-notice/outbox-failure-notice.component.spec.ts`, with `MAT_SNACK_BAR_DATA` and a `MatSnackBarRef` stub, proves:
  - The `rejected` and `otherSpreadsheet` labels contain the category, the amount and the `d MMM, HH:mm` date.
  - There are three buttons, named Retry, Discard and Close.
  - Each button sets its choice and calls `dismiss()` once.
- `[AC32]` `src/modules/dashboard/dashboard/dashboard-page.container.ts`, `.html` and `.scss` are byte-identical to before.

### Things that stay unchanged

- `[AC33]` `src/services/spreadsheet/expense-row.ts` is unchanged, and no sheet column, range string, gviz query or row index changes anywhere. In `spreadsheet.service.ts`, `addExpense`'s signature, URL, params and body construction are unchanged ([AC13] diff only). `src/services/spreadsheet/spreadsheet.service.spec.ts` is unmodified and green.
- `[AC34]` There is no OAuth scope or token lifecycle change. `src/services/security/abstract-security.service.ts`, `redirect-security.service.ts`, `popup-security.service.ts` and `src/http-interceptors/auth-interceptor.ts` are unchanged, and `SCOPES` is identical.
- `[AC35]` `ngsw-config.json`, `angular.json`, `package.json` and `package-lock.json` are unchanged, and no dependency is added.
- `[AC36]` These are byte-identical in `app.effects.ts`: `saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$`, `saveCategories$`, `loadCategories$`, `addCategory$`, `deleteCategory$`, `updateCategoryPosition$`, `deleteExpense$`, `loadExpenses$`, `showFailureToast$`. `src/modules/setup/**` and `src/shared/guards/index.ts` are unchanged.
- `[AC37]` Nothing about the outbox touches localStorage. `src/constants/local-storage-keys.ts`, `src/services/storage/**` and the `app` slice's `initialState` are unchanged. A search of the new and modified files for `localStorage`, `LocalStorageService` or `StorageService` finds no new occurrence.
- `[AC38]` These existing spec files are byte-identical (`git diff --stat` shows none of them) and pass:
  - `src/@state/app.effects.spec.ts`
  - `src/@state/app.reducers.spec.ts`
  - `src/@state/report-failure.spec.ts`
  - `src/shared/helpers/index.spec.ts`
  - `src/services/spreadsheet/spreadsheet.service.spec.ts`
  - `src/services/spreadsheet/expense-row.spec.ts`
  - `src/services/storage/local-storage.service.spec.ts`
  - `src/modules/dashboard/dashboard.component.spec.ts`
  - `src/modules/dashboard/categories/categories-page.container.spec.ts`
  - `src/modules/dashboard/statistics/statistics.container.spec.ts`
  - `src/shared/components/expenses-table/expenses-table.component.spec.ts`
  - `src/shared/components/dialog/dialog.component.spec.ts`
  - `src/app/app.component.spec.ts`

  Suites that are skipped today stay skipped.
- `[AC39]` `bash scripts/harness.sh --all` reports lint, typecheck, build and test all `passed` and ends `harness: green`. The new and modified files contain no `any` and no new `eslint-disable` beyond the documented pattern (an inline `eslint-disable-next-line` with a stated reason, per `CLAUDE.md`).

### Knowledge and CLAUDE.md

- `[AC40]` `knowledge/architecture/write-outbox.md` exists with OKF frontmatter (`type`, `title`, `description`, `tags`, `status`, `generated`, `sources` citing the new files). In present tense it describes: what is queued and why only `addExpense`; the IndexedDB database/store/record shape; the routing tree; triggers and preconditions; the pass and the Web Lock; error classification; the failure notice; the success reload; and the residual risks. `knowledge/index.md` lists it under Architecture.
- `[AC41]` These concepts describe current behaviour in present tense, with no "now/previously/since" narration:
  - `knowledge/flows/offline-and-updates.md`: the capability table's add-expense row, the "reads queue, writes do not" paragraph replaced, and the toolbar outbox indicator.
  - `knowledge/architecture/state-management.md`: two slices, the `outbox` shape, `OutboxEffects` in the catalogue, the reducer/effect table, the selectors, and IndexedDB hydration. The "effect goes unresponsive after its first failure" caveat is corrected, since `catchError` sits inside `exhaustMap` (`app.effects.ts:101-107,184-194`).
  - `knowledge/flows/add-expense.md`: routing, loading, and failure behaviour.
  - `knowledge/interfaces/ngrx-actions.md`: the `Outbox` action group.
  - `knowledge/architecture/dependency-wiring.md`: the `EffectsModule.forRoot` array and the `OutboxStorage` root binding.
  - `knowledge/operations/testing.md`: the new spec files and the real-IndexedDB/Web-Locks tests.
  - `knowledge/references/source-map.md`: the new files.
- `[AC42]` `knowledge/constraints/known-issues.md` gains present-tense open entries, numbered after the highest number ever used so existing references stay valid, for:
  - at-least-once duplicate rows on replay
  - the outbox surviving logout / a user change
  - a hung request holding the drain and its Web Lock (no timeout)
  - ordering exceptions (retried items, stale second tab)
  - timezone changes between queueing and sending
- `[AC43]` `knowledge/log.md` gains a new top entry dated 2026-09-12 that lists every concept touched and links `docs/specs/write-outbox.md` and `docs/architecture/write-outbox.md`. Change history appears only there.
- `[AC44]` `CLAUDE.md` is updated:
  - **"Things that will surprise you"** covers: `addExpense` may not touch the network (offline or behind the queue it goes to IndexedDB `exp-spsh-outbox` and is drained by `OutboxEffects`); the store has two slices (`app`, `outbox`) and two effects classes; the outbox lives in IndexedDB, is not in localStorage and survives logout (reset it via DevTools → Application → IndexedDB → delete `exp-spsh-outbox`); drain passes hold the Web Lock `exp-spsh-outbox-drain`.
  - **The knowledge table** gains a row pointing to `knowledge/architecture/write-outbox.md`.

### Human-only (not verifiable by an agent)

- `[AC45]` **Human-only.** Manual run on a scratch spreadsheet (`npm run watch` + `npm run serve`, `http://localhost:4200/exp-spsh/`, DevTools → Network → "Offline"):
  1. Online, add an expense. It behaves exactly as today: the row appears, the table reloads, and there is no badge.
  2. Go offline and add expenses A then B. The form resets each time, no toast appears, the toolbar button shows badge `2`, and a screen reader announces the queued message.
  3. Reload the page while offline. The badge still shows `2`.
  4. Go online. Within seconds the sheet has B in row 1 and A in row 2, each exactly once, the table reloads, the badge disappears, and "All saved expenses were sent" is announced.
- `[AC46]` **Human-only.** With DevTools request blocking on `content-sheets.googleapis.com` (so `navigator.onLine` stays true), add A. It is queued with no toast. Add B; it goes behind A. Remove the block and activate the toolbar button. A then B are written, B on top, each once.
- `[AC47]` **Human-only.** With two tabs of the app open on the same profile, disable the OS network, add two expenses in tab A, then re-enable the network. Each expense appears in the sheet exactly once, and both tabs' badges clear after their next pass (e.g. after a navigation).
- `[AC48]` **Human-only.** Use a scratch `data_Scratch` tab that setup has discovered:
  1. Block `content-sheets.googleapis.com` and queue an expense for Scratch.
  2. Delete the `data_Scratch` tab in the Sheets UI in another browser tab.
  3. Unblock and activate the toolbar button. The failure notice appears with the expense summary and Retry / Discard / Close.
  4. Retry reopens the notice after the next pass.
  5. Discard removes the item, and the badge clears.
- `[AC49]` **Human-only.** An AXE scan with the toolbar button visible (pending-only and failed states) and with the failure notice open reports no new violations. The button's accessible name reads the counts. The button and all three notice buttons can be reached and operated by keyboard. Colour contrast of the badge meets WCAG AA. The toolbar layout does not crowd or overlap the avatar on a 360 px wide viewport.
