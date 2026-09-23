---
type: Architecture Component
title: Write outbox for addExpense
description: The offline/retry queue for addExpense - what is queued, how it is persisted in IndexedDB, the drain loop's triggers and preconditions, error classification, and the failure notice.
tags: [architecture, ngrx, outbox, offline, indexeddb, effects]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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

# Why only `addExpense`

`addExpense` always inserts at row 0, so replaying it later still lands correctly and send
order equals sheet order. Every other write is positional against current state
(`deleteExpense`, `deleteCategory`), a full-range overwrite (`updateCategoryPosition`), or a
setup call; replaying those could hit the wrong row, so they are never queued.[^appeffects]

# Record and persistence

`OutboxRecord`:[^model]

```ts
interface OutboxRecord {
  localId: string;            // crypto.randomUUID()
  kind: 'addExpense';
  spreadsheetId: string;      // SpreadsheetService.getSpreadsheetId() at routing time
  payload: { sheetId: number; expense: Expense };  // the 5 Expense fields only
  enqueuedAt: number;         // Date.now() at routing time
  status: 'pending' | 'failed';
  attempts: number;
  lastError?: string;         // toMessage(e)
  failure?: 'rejected' | 'otherSpreadsheet';  // only when status is 'failed'
}
```

`OutboxStorage` is an abstract class that is its own DI token, root-bound to
`IndexedDbOutboxStorage`.[^storage] That implementation uses raw IndexedDB — database
`exp-spsh-outbox`, version 1, store `writes` keyed by `localId`:[^idb]

- the connection opens lazily and is dropped on `versionchange` or `close`, so DevTools can
  delete the database and the next operation reopens;
- records round-trip by structured clone, so `payload.expense.date` stays a `Date`;
- each operation settles on the transaction's `complete` event, so commit-time aborts (quota,
  forced close) and synchronous `InvalidStateError`s reach the caller as errors.

`InMemoryOutboxStorage` is a `Map`-backed test double, never used in production. Both
implementations import `OutboxStorage` with `import type` to avoid a load-time cycle.

The `outbox` slice mirrors IndexedDB through `hydrated` (`setAll`). A record enters the store
only after its `storage.add` committed.[^reducers]

# Routing a new `addExpense`

`AppEffects.addExpense$` decides; `OutboxEffects` owns everything after.[^appeffects]

```
usable := OutboxStorage.isAvailable()              -- indexedDB and crypto.randomUUID exist
          AND getSpreadsheetId() != ''
if not usable        -> live: loading(true); send; success -> loadExpenses; error -> reportFailure
if offline           -> enqueue(record, drain: false)
else if pending > 0  -> enqueue(record, drain: true)     -- stay behind queued items
else                 -> live: loading(true); send
    success          -> loadExpenses(that day)
    retryable | auth -> loading(false); enqueue(record{attempts: 1, lastError}, drain: false)
    terminal         -> reportFailure('addExpense$')
```

`pending` counts `status === 'pending'` only; failed records never block a live add.

# Enqueue is persist-first

`persistEnqueue$` handles `enqueue`: `storage.add` → `enqueued` (reducer `addOne`) →
`drainRequested` if `drain` → `LiveAnnouncer` announces `OUTBOX_MESSAGES.queued` (polite). If
`add` fails, it runs `reportFailure('addExpense$')` and dispatches nothing else.[^effects]

# Drain triggers and preconditions

At most one pass runs per tab. Triggers:[^effects]

| | Trigger |
|---|---|
| T1 | boot hydration succeeded |
| T2 | `online$` rising edge (`false` → `true`) |
| T3 | every router `NavigationEnd` |
| T4 | `drainRequested` (behind-the-queue enqueue, Retry) |
| T5 | `syncRequested` (toolbar outbox button) |

A trigger during a running pass sets a flag; exactly one more pass runs afterwards. Failures
never trigger a pass — there is no timer or backoff.

A pass ends silently (one `log()` line) unless: **P1** boot hydration succeeded, **P2**
`online$` is `true`, **P3** `user$` holds a user, **P4** a spreadsheet id is set.

# One pass, inside the Web Lock

`OutboxDrainLock.run` holds the exclusive Web Lock `exp-spsh-outbox-drain` for the whole
pass; without `navigator.locks` it runs unlocked and logs once.[^lock]

```
hydrated(storage.getAll())
loop:
  next := oldest 'pending' in a fresh storage.getAll(), by (enqueuedAt, localId); none -> break
  already sent this session       -> storage.remove(next); continue
  offline now                     -> break
  next.spreadsheetId != current   -> failed/'otherSpreadsheet'; terminallyFailed; continue
  attemptStarted; SpreadsheetService.addExpense(sheetId, expense)
    success   -> remember localId; storage.remove; succeeded; continue
    retryable -> attempts+1, stays pending; retryableFailed; break
    auth      -> as retryable; the first auth stop since the last success also dispatches
                 operationFailed({ source: 'outboxDrain$', message: OUTBOX_MESSAGES.authBlocked })
    terminal  -> failed/'rejected', attempts+1; terminallyFailed; continue
hydrated(storage.getAll())
drainCompleted({ sent, newlyFailed, remainingPending, lastSent })
```

A storage error inside the loop ends the pass. The in-memory "sent this session" set
prevents a resend when `remove` failed.

# `classifyWriteError`

First match wins:[^helpers]

1. not an `HttpErrorResponse` → `terminal`
2. `status === 0` → `retryable`
3. OAuth token endpoint URL: 408/429/5xx → `retryable`, otherwise → `auth`
4. `401` → `auth`
5. 408/429/5xx → `retryable`
6. anything else → `terminal`

# Failure notice

`OutboxFailureNoticeComponent` is a snackbar body opened with `openFromComponent` for the
oldest failed record, when `drainCompleted.newlyFailed > 0` or when `syncRequested` fires and
a failed record exists.[^notice] Its text differs for `otherSpreadsheet`. Buttons set
`choice()`, read by `OutboxEffects` after `afterDismissed()`:

- **Retry** → status `pending`, `failure` cleared, `enqueuedAt` kept → `hydrated` → `drainRequested`
- **Discard** → record removed → `hydrated`
- **Close**, or dismissal by another snackbar → nothing

# Feedback

- `OutboxStatusComponent` (toolbar, only while signed in) renders nothing at 0/0; otherwise
  a `cloud_upload` button badged `pending + failed` (`warn` if any failed, else `accent`)
  whose `aria-label` states the counts and ends "Send now". Clicking dispatches
  `syncRequested`.[^status]
- `drainCompleted` with `sent > 0` and `remainingPending === 0` announces
  `OUTBOX_MESSAGES.allSent` (polite).
- `drainCompleted` with `sent > 0` dispatches one `loadExpenses` for the last sent record's
  sheet and day, only when the current route is exactly `/dashboard`.

# Accepted risks

- **Duplicates.** A batch applied by Google whose response is lost is retried → duplicate row
  (no row id). [Known issues](../constraints/known-issues.md) #23.
- **Order.** A retried record, or a stale second tab sending live, can land out of entry
  order. #24.
- **Survives logout.** `logout()` clears localStorage only. #25.
- **No timeout.** A hung request holds the pass and the lock until reload. #26.
- **Timezone.** The date's serial number is computed at send time. #27.

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
