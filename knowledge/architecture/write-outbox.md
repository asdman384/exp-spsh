---
type: Architecture Component
title: Write outbox for addExpense
description: The offline/retry queue for addExpense - what is queued, how it is persisted in IndexedDB, the drain loop's triggers and preconditions, error classification, and the failure notice.
tags: [architecture, ngrx, outbox, offline, indexeddb, effects]
status: stable
generated: { by: claude_code/claude-sonnet-5, at: 2026-09-12T00:00:00Z }
sources:
  - id: model
    resource: ../../src/shared/models/outbox-record.ts
    title: OutboxRecord
  - id: outboxstate
    resource: ../../src/@state/outbox.model.ts
    title: OutboxState
  - id: actions
    resource: ../../src/@state/outbox.actions.ts
    title: OutboxActions
  - id: reducers
    resource: ../../src/@state/outbox.reducers.ts
    title: outboxAdapter / outboxReducer
  - id: selectors
    resource: ../../src/@state/outbox.selectors.ts
    title: Outbox selectors
  - id: effects
    resource: ../../src/@state/outbox.effects.ts
    title: OutboxEffects
  - id: appeffects
    resource: ../../src/@state/app.effects.ts
    title: AppEffects.addExpense$ routing
  - id: storage
    resource: ../../src/services/outbox/outbox-storage.ts
    title: OutboxStorage
  - id: idb
    resource: ../../src/services/outbox/indexed-db-outbox-storage.service.ts
    title: IndexedDbOutboxStorage
  - id: lock
    resource: ../../src/services/outbox/outbox-drain-lock.service.ts
    title: OutboxDrainLock
  - id: helpers
    resource: ../../src/shared/helpers/index.ts
    title: classifyWriteError
  - id: notice
    resource: ../../src/shared/components/outbox-failure-notice/outbox-failure-notice.component.ts
    title: OutboxFailureNoticeComponent
  - id: status
    resource: ../../src/shared/components/outbox-status/outbox-status.component.ts
    title: OutboxStatusComponent
spec:
  - ../../docs/specs/write-outbox.md
  - ../../docs/architecture/write-outbox.md
---

# What is queued, and why only `addExpense`

Every write except `addExpense` is either positional against the current state (`deleteExpense`,
`deleteCategory`, an index into a fresh read), a full-range overwrite
(`updateCategoryPosition`), or a low-frequency setup/admin call. Replaying any of those after
other writes have landed would risk touching the wrong row or clobbering a concurrent edit, so
none of them is queued: each simply fails when offline or on a connectivity error. `addExpense` inserts
a row at a fixed position (row 0), so replaying it later still produces a correct result: the
order the queue sends things in *is* the order they land in the sheet.[^appeffects]

# Record shape and persistence

`OutboxRecord` (`src/shared/models/outbox-record.ts`) is:[^model]

```ts
interface OutboxRecord {
  localId: string;            // crypto.randomUUID()
  kind: 'addExpense';
  spreadsheetId: string;      // SpreadsheetService.getSpreadsheetId() at routing time
  payload: { sheetId: number; expense: Expense };  // exactly the 5 Expense keys, no `sheet`
  enqueuedAt: number;         // Date.now() at routing time
  status: 'pending' | 'failed';
  attempts: number;
  lastError?: string;         // toMessage(e), never a URL
  failure?: 'rejected' | 'otherSpreadsheet';  // set only when status is 'failed'
}
```

Persistence is `OutboxStorage` (`src/services/outbox/outbox-storage.ts`), an abstract class used
as its own DI token with a root default binding to `IndexedDbOutboxStorage`
(`providedIn: 'root'` on the abstract class itself, resolved via a `useFactory` that injects the
implementation) — there is no provider line in `app.config.ts`.[^storage] The real
implementation opens raw IndexedDB lazily (never in the constructor): database
`exp-spsh-outbox`, version `1`, one object store `writes` keyed by `localId`. Records round-trip
by structured clone, never `JSON.stringify`, so a `Date` in `payload.expense.date` survives
intact. The connection closes itself on `versionchange`, so a `deleteDatabase` from DevTools or
a test isn't blocked; it also drops its cached connection when the browser closes it outright
(the `close` event, e.g. site data cleared while the tab is open), so the next operation reopens
rather than reusing a dead connection. Every operation's Observable settles only when its
transaction's `complete` event fires — never on the underlying request's `success` alone — so a
commit-time abort or error (quota, I/O, a forced connection close) reaches the caller as an error
instead of being reported as success. A synchronous throw while creating the transaction, such as
`InvalidStateError` on a connection the browser has already closed, reaches the caller as an
error the same way, rather than going unobserved.[^idb] `InMemoryOutboxStorage` (`src/services/outbox/in-memory-outbox-storage.ts`)
is the same contract backed by a `Map`, used only by tests, and never wired into
`app.config.ts`.

The two implementation files import `OutboxStorage` as a type-only import and use `implements`,
never `extends`. Only `outbox-storage.ts` itself imports the real `IndexedDbOutboxStorage` class
(for its default binding), so the module graph has exactly one runtime edge between the two
files, avoiding a load-time TDZ cycle.

The `outbox` NgRx slice (`src/@state/outbox.model.ts`, `.reducers.ts`) mirrors whatever is in
IndexedDB via `OutboxActions.hydrated({ records })`, which replaces the whole entity collection
(`setAll`). The store is always a subset of IndexedDB: nothing is added to the store except
through a `storage.add` whose transaction has already committed (see "Enqueue is persist-first"
below), so a stale in-memory record is never possible.[^reducers]

# Routing a new `addExpense` (`AppEffects.addExpense$`)

`AppEffects.addExpense$` decides between the live write and the queue; `OutboxEffects` owns
everything after that.[^appeffects]

```
usable := OutboxStorage.isAvailable() AND SpreadsheetService.getSpreadsheetId() != ''
if not usable                    -> today's live path, unchanged: loading(true), send,
                                     success -> loadExpenses, error -> reportFailure('addExpense$')
online  := current online$ (take 1)
pending := current pendingCountSelector (take 1) -- failed records don't count
if not online                    -> enqueue(record, drain: false)
else if pending > 0              -> enqueue(record, drain: true)  -- keep insertion order
else                              -> live: loading(true); send
     success                     -> loadExpenses (unchanged)
     error, classified retryable or auth -> loading(false); enqueue(record with attempts 1, lastError)
     error, classified terminal  -> reportFailure('addExpense$') (unchanged, no enqueue)
```

`OutboxStorage.isAvailable()` is a synchronous capability probe: `indexedDB` and
`crypto.randomUUID` must both exist. If it is false, or the spreadsheet id hasn't been set yet,
`addExpense` sends directly and never touches the outbox: `loading(true)`, the request,
`loadExpenses` on success, `reportFailure('addExpense$')` on any error.

# Enqueue is persist-first

`OutboxActions.enqueue({ record, drain })` is an intent, handled only by
`OutboxEffects.persistEnqueue$`. Enqueue writes to IndexedDB *before* anything is added to the
store: on a successful `storage.add`, the effect dispatches `enqueued` (which the reducer adds
via `addOne`), then `drainRequested()` when `drain` is true, then announces
`OUTBOX_MESSAGES.queued` through `LiveAnnouncer` at `politeness: 'polite'`. A failed `add` —
whether the request itself errors (e.g. a duplicate `localId`) or the transaction later aborts
(e.g. quota exhaustion) — errors the `OutboxStorage.add` Observable, and the effect runs the
existing `reportFailure('addExpense$', store)` — the same visible toast a live failure would
show — and dispatches no `enqueued`.[^effects] This ordering means a drain pass can never observe
a record that isn't already durable.

# The drain loop: triggers and preconditions

At most one drain pass runs per tab. Five things start a pass, merged into one trigger
stream:[^effects]

| Trigger | Source |
|---|---|
| T1 | Boot hydration completing successfully (`ROOT_EFFECTS_INIT` -> `storage.getAll()` -> `hydrated`) |
| T2 | A rising edge of `NetworkStatusService.online$` (a `true` whose previous emission was `false`) |
| T3 | Every Angular Router `NavigationEnd` |
| T4 | `OutboxActions.drainRequested()` — dispatched by a behind-the-queue enqueue, or by Retry |
| T5 | `OutboxActions.syncRequested()` — dispatched when the toolbar button is activated |

A trigger arriving while a pass is running (including while it waits for the lock) is
coalesced: exactly one more pass runs once the current one ends, no matter how many triggers
arrived. No trigger is ever emitted *because of* a failure, so a failing queue with no new
external event makes exactly one send per trigger — there is no timer-based retry or backoff.

Before any storage read or lock acquisition, all of these must hold, or the pass ends silently
(a `log()` line, no action, no storage call):

- **P1** boot hydration in this tab has completed successfully (an internal flag, set once by
  T1 and never reset)
- **P2** the current value of `online$` is `true`
- **P3** the current value of `AbstractSecurityService.user$` is defined
- **P4** `SpreadsheetService.getSpreadsheetId()` is non-empty

`categoriesSheetId` is not a precondition, because `addExpense` doesn't use it.

# One pass, inside the Web Lock

Each pass runs inside `OutboxDrainLock.run(work)`
(`src/services/outbox/outbox-drain-lock.service.ts`), which holds an exclusive,
waiting-mode `navigator.locks` lock named `exp-spsh-outbox-drain` for the whole pass. If
`navigator.locks` is unavailable, the work runs unlocked and a fallback is logged once per
session.[^lock] Inside the lock:[^effects]

```
snapshot := storage.getAll(); dispatch hydrated(snapshot)
loop:
  snapshot := storage.getAll()                          -- fresh read before every item
  next := oldest 'pending' record by (enqueuedAt, localId); none -> break
  if next.localId already sent this session   -> storage.remove(next); continue
  if not online$ right now                    -> break
  if next.spreadsheetId != getSpreadsheetId()
                                               -> failed/otherSpreadsheet, no send, continue
  dispatch attemptStarted; send addExpense(next.payload.sheetId, next.payload.expense)
    success   -> mark sent this session; storage.remove; dispatch succeeded; continue
    retryable -> attempts+1, stays pending; dispatch retryableFailed; break
    auth      -> same as retryable; the *first* such stop since the last success also
                 dispatches AppActions.operationFailed({ source: 'outboxDrain$', ... }); break
    terminal  -> failed/rejected, attempts+1; dispatch terminallyFailed; continue
final := storage.getAll(); dispatch hydrated(final)
dispatch drainCompleted({ sent, newlyFailed, remainingPending, lastSent })
```

A per-session `Set<localId>` of successful sends means a record is never sent twice in one
session even if its `remove` failed — a later pass just retries the removal. Because every item
is picked from a fresh `getAll()`, and the lock is held across tabs, a second tab's pass only
ever sees what the first tab actually left behind.

# Error classification (`classifyWriteError`)

`src/shared/helpers/index.ts` exports `classifyWriteError(e: unknown): 'retryable' | 'auth' |
'terminal'`, checked in order:[^helpers]

1. not an `HttpErrorResponse` -> `terminal`
2. `status === 0` (network failure, blocked request, CORS, abort) -> `retryable`
3. the request URL is the OAuth token endpoint and status is 408/429/5xx -> `retryable`
4. the request URL is the OAuth token endpoint, any other status -> `auth`
5. `status === 401` -> `auth`
6. `status` is 408, 429, or 5xx -> `retryable`
7. anything else (400, 403, 404, 409, 413, other 4xx, a 2xx with an unparsable body) -> `terminal`

`retryable` and `auth` both keep the record `pending` and stop the pass; `auth` additionally
raises one toast per "episode" (silenced until the next successful send). `terminal` marks the
record `failed` and the pass continues with the next item. The token lifecycle itself
(`AbstractSecurityService`, `ExpAuthInterceptor`) is unchanged; a replayed write goes through
the same interceptor as a live one.

# The failure notice: Retry and Discard

A `failed` record is surfaced through `OutboxFailureNoticeComponent`
(`src/shared/components/outbox-failure-notice/`), a small snackbar body opened with
`MatSnackBar.openFromComponent` — not the plain snackbar action slot `showFailureToast$` uses,
and not a new `FailureSource` (that would break `report-failure.spec.ts`'s exact key
list).[^notice] It is opened for the oldest failed record (by the same `(enqueuedAt, localId)`
order) in two cases: when a pass's `drainCompleted` reports `newlyFailed > 0`, and when
`syncRequested` fires while at least one failed record exists. Its three buttons — Retry,
Discard, Close — record a choice on the component instance (`choice()`, a signal read by
`OutboxEffects` via `MatSnackBarRef.instance` after `afterDismissed()`), then dismiss:

- **Retry** -> the record goes back to `pending` (its `failure` cleared, its original
  `enqueuedAt` kept) -> `hydrated` -> `drainRequested()`.
- **Discard** -> the record is removed -> `hydrated`.
- **Close**, or dismissal by another snackbar -> nothing.

# Feedback: badge, announcements, reload

`OutboxStatusComponent` (`src/shared/components/outbox-status/`) is a toolbar button fed by
`pendingCountSelector`/`failedCountSelector`; it renders nothing at 0/0, otherwise a badge
showing `pending + failed` (colour `warn` when anything has failed, `accent` otherwise) whose
accessible name states the counts and ends "`. Send now`". Activating it dispatches
`OutboxActions.syncRequested()` (T5).[^status]

Queueing an expense announces `OUTBOX_MESSAGES.queued` through `LiveAnnouncer` at
`politeness: 'polite'` — no snackbar, so it never competes with a visible failure toast.
When a pass sends at least one record and the queue is now empty, `OUTBOX_MESSAGES.allSent` is
announced the same way. When a pass sends at least one record, `OutboxEffects` dispatches exactly
one `AppActions.loadExpenses` for the *last sent* record's sheet and day — mirroring the live
add's one-day reload window — and only when the router's current path is exactly `/dashboard`
(the same `expenses` state also backs `/dashboard/statistics`).

# Residual risks (accepted, not solved)

- **Duplicate rows.** If Google applied a batch but the response was lost, the record is
  retried and produces a genuine duplicate row. There is no id column or dedupe key (out of
  scope for this slice); see [known issues](../constraints/known-issues.md).
- **The outbox survives logout.** `AbstractSecurityService.logout()` only clears
  `LocalStorageService`; a queued or failed record (and the spreadsheet-mismatch summary a
  next user on a shared device would see) is untouched.
- **No request timeout.** A hung `addExpense` holds a pass, and the Web Lock, until the tab is
  reloaded — nothing is lost, since records stay in IndexedDB, but every other tab's pass waits
  behind it.
- **Ordering can be "order sent", not "order entered"**, for a retried failed record, or for a
  second tab whose stale pending count let it send live ahead of another tab's queued items.
- **Timezone changes between queueing and sending.** A queued expense's date is converted to a
  Sheets serial number at send time, under the device's timezone at that instant, which can
  differ from the timezone when it was entered.

[^model]: OutboxRecord
[^storage]: OutboxStorage
[^idb]: IndexedDbOutboxStorage
[^lock]: OutboxDrainLock
[^effects]: OutboxEffects
[^appeffects]: AppEffects.addExpense$ routing
[^helpers]: classifyWriteError
[^notice]: OutboxFailureNoticeComponent
[^status]: OutboxStatusComponent
[^reducers]: outboxAdapter / outboxReducer
