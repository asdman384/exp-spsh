---
type: Architecture Component
title: Write outbox for addExpense
description: The offline/retry queue for addExpense - what is queued, how it is persisted in IndexedDB, the drain loop's triggers and preconditions, error classification, and the failure notice.
tags: [architecture, outbox, offline, indexeddb, signals]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: model
    resource: ../../src/shared/models/outbox-record.ts
    title: OutboxRecord
  - id: service
    resource: ../../src/services/outbox/outbox.service.ts
    title: OutboxService
  - id: messages
    resource: ../../src/services/outbox/outbox-messages.ts
    title: OUTBOX_MESSAGES
  - id: expenses
    resource: ../../src/modules/dashboard/expenses.service.ts
    title: ExpensesService
  - id: storage
    resource: ../../src/services/outbox/outbox-storage.ts
    title: OutboxStorage
  - id: idb
    resource: ../../src/services/outbox/indexed-db-outbox-storage.service.ts
    title: IndexedDbOutboxStorage
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
setup call; replaying those could hit the wrong row, so they are never queued.

# Record and persistence

`OutboxRecord`:[^model]

```ts
interface OutboxRecord {
  localId: string;            // crypto.randomUUID()
  kind: 'addExpense';
  spreadsheetId: string;      // SpreadsheetService.getSpreadsheetId() when queued
  payload: { sheetId: number; expense: Expense };  // the 5 Expense fields only
  enqueuedAt: number;         // Date.now() when queued
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

# `OutboxService`

A root service, not NgRx; there are no outbox actions, reducer, or selectors.[^service]

| Member | Behaviour |
|---|---|
| `records` | read-only signal mirroring IndexedDB, ordered by `(enqueuedAt, localId)` |
| `pendingCount`, `failedCount` | `computed` counts by `status` (pending only / failed only) |
| `sent$` | emits the last sent record once per pass that sent anything |
| `init()` | hydrates and subscribes to the triggers; idempotent. `app.config.ts` calls it from `provideAppInitializer` |
| `add(sheetId, expense)` | builds and queues a record (below) |
| `sync()` | the toolbar "Send now" (T5) |

`records` is replaced from `storage.getAll()` at hydration, at the start and end of every
pass, and after Retry/Discard; in between, the pass patches the one record it just changed.
A record enters `records` only after its `storage.add` committed. The service still uses the
NgRx store for two app-wide things: `reportFailure` / `operationFailed` for toasts.

# Every new expense is queued

There is no live write path. `ExpensesService.add` calls `OutboxService.add`, which builds a
record with `attempts: 0` and the current spreadsheet id, online or not.[^expenses]

# Enqueue is persist-first

Adds go through a `concatMap`, so they persist in call order: `storage.add` → append to
`records` → start a pass (T4) → `LiveAnnouncer` announces `OUTBOX_MESSAGES.queued`
(polite).[^messages] If `add` fails (for example, no IndexedDB), it runs
`reportFailure('addExpense$')` and nothing else.

# Drain triggers and preconditions

At most one pass runs at a time. There is no cross-tab coordination: the app is a phone PWA
used in a single tab. Triggers:[^service]

| | Trigger |
|---|---|
| T1 | boot hydration succeeded |
| T2 | `online$` rising edge (`false` → `true`) |
| T3 | every router `NavigationEnd` |
| T4 | every `add`, and Retry |
| T5 | `sync()` (toolbar outbox button) |

A trigger during a running pass sets a flag; exactly one more pass runs afterwards. Failures
never trigger a pass — there is no timer or backoff.

A pass ends silently (one `log()` line) unless: **P1** boot hydration succeeded, **P2**
`online$` is `true`, **P3** `user$` holds a user, **P4** a spreadsheet id is set.

# One pass

```
records := storage.getAll()
loop:
  next := oldest 'pending' in a fresh storage.getAll(), by (enqueuedAt, localId); none -> break
  already sent this session       -> storage.remove(next); continue
  offline now                     -> break
  next.spreadsheetId != current   -> failed/'otherSpreadsheet' (newly failed); continue
  SpreadsheetService.addExpense(sheetId, expense)
    success   -> remember localId; storage.remove; drop from records; continue
    retryable -> attempts+1, stays pending; break
    auth      -> as retryable; the first auth stop since the last success also dispatches
                 operationFailed({ source: 'outboxDrain$', message: OUTBOX_MESSAGES.authBlocked })
    terminal  -> failed/'rejected', attempts+1 (newly failed); continue
records := storage.getAll()
newly failed > 0                  -> failure notice
sent > 0 and no pending left      -> announce allSent
sent > 0                          -> sent$.next(last sent record)
```

Each status change is written to storage first and then patched into `records`.

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
oldest failed record, at the end of a pass that newly failed a record, or on `sync()` when a
failed record exists.[^notice] Its text differs for `otherSpreadsheet`. Buttons set
`choice()`, read by `OutboxService` after `afterDismissed()`:

- **Retry** → status `pending`, `failure` cleared, `enqueuedAt` kept → `records` reloaded → a pass starts
- **Discard** → record removed → `records` reloaded
- **Close**, or dismissal by another snackbar → nothing

# Feedback

- `OutboxStatusComponent` (toolbar, only while signed in) renders nothing at 0/0; otherwise
  a `cloud_upload` button badged `pending + failed` (`warn` if any failed, else `accent`)
  whose `aria-label` states the counts and ends "Send now". `AppComponent` feeds it
  `pendingCount()` / `failedCount()`; clicking calls `sync()`.[^status]
- A pass that sent something and left nothing pending announces `OUTBOX_MESSAGES.allSent`
  (polite).
- On `sent$`, `ExpensesService` loads the last sent record's sheet and day once, only when
  the current route is exactly `/dashboard`.

# Accepted risks

- **Duplicates.** A batch applied by Google whose response is lost is retried → duplicate row
  (no row id). [Known issues](../constraints/known-issues.md) #23.
- **Order.** A retried record can land out of entry order. #24.
- **Survives logout.** `logout()` clears localStorage only. #25.
- **No timeout.** A hung request holds the pass until reload. #26.
- **Timezone.** The date's serial number is computed at send time. #27.

[^model]: OutboxRecord
[^storage]: OutboxStorage
[^idb]: IndexedDbOutboxStorage
[^service]: OutboxService
[^messages]: OUTBOX_MESSAGES
[^expenses]: ExpensesService
[^helpers]: classifyWriteError
[^notice]: OutboxFailureNoticeComponent
[^status]: OutboxStatusComponent
