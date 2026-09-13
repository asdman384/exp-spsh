import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';

import { OutboxRecord } from 'src/shared/models';

import { IndexedDbOutboxStorage } from './indexed-db-outbox-storage.service';
import { OutboxStorage } from './outbox-storage';

const DB_NAME = 'exp-spsh-outbox';

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error as unknown);
    // The implementation closes its own connection on `versionchange`, so this should never
    // actually fire -- if it does, that itself is evidence of a production defect ([AC8]).
    request.onblocked = () => resolve();
  });
}

function makeRecord(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
  return {
    localId: 'r-1',
    kind: 'addExpense',
    spreadsheetId: 'spsh-1',
    payload: {
      sheetId: 3,
      expense: { date: new Date(2024, 5, 1, 10, 0, 0), amount: 12.5, category: 'Food', comment: 'lunch', isInDebt: false }
    },
    enqueuedAt: 1000,
    status: 'pending',
    attempts: 0,
    ...overrides
  };
}

// [AC7] The abstract `OutboxStorage` token must resolve to `IndexedDbOutboxStorage` from a bare
// TestBed, and must not touch IndexedDB just by being injected.
describe('[AC7] OutboxStorage root binding', () => {
  it('should_resolve_to_IndexedDbOutboxStorage_from_a_bare_TestBed_without_opening_a_database', () => {
    const openSpy = vi.spyOn(indexedDB, 'open');

    TestBed.configureTestingModule({});
    const storage = TestBed.inject(OutboxStorage);

    expect(storage).toBeInstanceOf(IndexedDbOutboxStorage);
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });
});

// [AC10] Against real IndexedDB in headless Chromium.
describe('[AC10] IndexedDbOutboxStorage against real IndexedDB', () => {
  let storage: IndexedDbOutboxStorage;

  beforeEach(async () => {
    await deleteDb();
    TestBed.configureTestingModule({ providers: [IndexedDbOutboxStorage] });
    storage = TestBed.inject(IndexedDbOutboxStorage);
  });

  afterEach(async () => {
    await deleteDb();
  });

  it('should_round_trip_a_record_whose_date_survives_as_a_Date_instance_with_the_same_getTime', async () => {
    const date = new Date(2024, 5, 1, 10, 0, 0);
    const record = makeRecord({
      localId: 'date-record',
      payload: { sheetId: 1, expense: { date, amount: 1, category: 'Food', comment: '', isInDebt: false } }
    });

    await firstValueFrom(storage.add(record));
    const all = await firstValueFrom(storage.getAll());

    expect(all).toHaveLength(1);
    expect(all[0].payload.expense.date).toBeInstanceOf(Date);
    expect(all[0].payload.expense.date!.getTime()).toBe(date.getTime());
  });

  it('should_error_when_adding_a_duplicate_localId', async () => {
    const record = makeRecord({ localId: 'dup' });
    await firstValueFrom(storage.add(record));

    await expect(firstValueFrom(storage.add(record))).rejects.toBeDefined();
  });

  it('should_patch_only_the_fields_given_to_updateStatus', async () => {
    const record = makeRecord({ localId: 'patch-me', attempts: 0, lastError: undefined, spreadsheetId: 'spsh-keep' });
    await firstValueFrom(storage.add(record));

    await firstValueFrom(storage.updateStatus('patch-me', { status: 'failed', failure: 'rejected' }));

    const [updated] = await firstValueFrom(storage.getAll());
    expect(updated.status).toBe('failed');
    expect(updated.failure).toBe('rejected');
    expect(updated.attempts).toBe(0); // untouched
    expect(updated.spreadsheetId).toBe('spsh-keep'); // untouched
    expect(updated.payload).toEqual(record.payload); // untouched
  });

  it('should_complete_without_error_when_remove_targets_an_absent_id', async () => {
    await expect(firstValueFrom(storage.remove('does-not-exist'))).resolves.toBeUndefined();
  });

  it('should_complete_without_error_when_updateStatus_targets_an_absent_id', async () => {
    await expect(firstValueFrom(storage.updateStatus('does-not-exist', { status: 'failed' }))).resolves.toBeUndefined();
  });

  it('should_leave_getAll_empty_when_add_is_immediately_followed_by_remove_of_the_same_id_in_the_same_tick', async () => {
    const record = makeRecord({ localId: 'add-then-remove' });

    const addPromise = firstValueFrom(storage.add(record));
    const removePromise = firstValueFrom(storage.remove('add-then-remove'));
    await Promise.all([addPromise, removePromise]);

    const all = await firstValueFrom(storage.getAll());
    expect(all).toEqual([]);
  });

  it('should_let_a_second_fresh_instance_see_records_written_by_the_first', async () => {
    const record = makeRecord({ localId: 'cross-instance' });
    await firstValueFrom(storage.add(record));

    // A genuinely fresh instance, its own lazily-opened connection -- not the DI singleton.
    const second = new IndexedDbOutboxStorage();
    const all = await firstValueFrom(second.getAll());

    expect(all.map((r) => r.localId)).toContain('cross-instance');
  });
});

// [AC7]/R-2 regression (docs/reviews/write-outbox.md Required 2, D11's "emits once (or errors)"
// contract): each operation must settle on the *transaction's* outcome, not the request's. We
// force a commit-time abort by hooking the write request's own `success` event (added via
// `addEventListener`, which -- because it is registered before the production code's `onsuccess`
// property is assigned -- runs first) and calling `transaction.abort()` from inside it. Against
// the pre-fix `withStore`, which resolved on `request.onsuccess` alone and never listened for
// `onabort`, this abort would go unnoticed: the Observable would still emit and complete, and the
// "not persisted" assertion below would fail because the write would already be durably queued to
// commit before our hook could intervene -- in fact under the pre-fix code the promise service
// resolves synchronously with the request result, well before the (still-forthcoming) abort, so
// the caller believes the write is confirmed. Follows the [AC10] describe's real-IndexedDB setup
// and DB cleanup.
describe('[AC7] IndexedDbOutboxStorage transaction-abort durability (R-2)', () => {
  let storage: IndexedDbOutboxStorage;

  beforeEach(async () => {
    await deleteDb();
    TestBed.configureTestingModule({ providers: [IndexedDbOutboxStorage] });
    storage = TestBed.inject(IndexedDbOutboxStorage);
  });

  afterEach(async () => {
    await deleteDb();
  });

  // Each helper aborts the transaction from inside its own write method's `success` event, i.e.
  // after the request has already succeeded but before the transaction commits. Written as three
  // separately-typed helpers (rather than one generic over the method name) so no signature needs
  // erasing to `any`.
  function abortTransactionAfterAddSucceeds(): () => void {
    const original = IDBObjectStore.prototype.add;
    const spy = vi
      .spyOn(IDBObjectStore.prototype, 'add')
      .mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        const request = original.call(this, value, key);
        request.addEventListener('success', () => request.transaction?.abort());
        return request;
      });
    return () => spy.mockRestore();
  }

  function abortTransactionAfterPutSucceeds(): () => void {
    const original = IDBObjectStore.prototype.put;
    const spy = vi
      .spyOn(IDBObjectStore.prototype, 'put')
      .mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        const request = original.call(this, value, key);
        request.addEventListener('success', () => request.transaction?.abort());
        return request;
      });
    return () => spy.mockRestore();
  }

  function abortTransactionAfterDeleteSucceeds(): () => void {
    const original = IDBObjectStore.prototype.delete;
    const spy = vi
      .spyOn(IDBObjectStore.prototype, 'delete')
      .mockImplementation(function (this: IDBObjectStore, query: IDBValidKey | IDBKeyRange) {
        const request = original.call(this, query);
        request.addEventListener('success', () => request.transaction?.abort());
        return request;
      });
    return () => spy.mockRestore();
  }

  it('should_error_and_not_persist_the_record_when_the_add_transaction_aborts_after_its_request_succeeds', async () => {
    const restore = abortTransactionAfterAddSucceeds();
    const record = makeRecord({ localId: 'abort-add' });

    try {
      await expect(firstValueFrom(storage.add(record))).rejects.toBeDefined();
    } finally {
      restore();
    }

    const fresh = new IndexedDbOutboxStorage();
    const all = await firstValueFrom(fresh.getAll());
    expect(all.map((r) => r.localId)).not.toContain('abort-add');
  });

  it('should_error_and_leave_the_prior_status_when_the_updateStatus_transaction_aborts_after_its_put_succeeds', async () => {
    const record = makeRecord({ localId: 'abort-update', status: 'pending' });
    await firstValueFrom(storage.add(record));

    const restore = abortTransactionAfterPutSucceeds();
    try {
      await expect(
        firstValueFrom(storage.updateStatus('abort-update', { status: 'failed', failure: 'rejected' }))
      ).rejects.toBeDefined();
    } finally {
      restore();
    }

    const fresh = new IndexedDbOutboxStorage();
    const all = await firstValueFrom(fresh.getAll());
    const persisted = all.find((r) => r.localId === 'abort-update');
    expect(persisted?.status).toBe('pending');
    expect(persisted?.failure).toBeUndefined();
  });

  it('should_error_and_not_remove_the_record_when_the_remove_transaction_aborts_after_its_delete_succeeds', async () => {
    const record = makeRecord({ localId: 'abort-remove' });
    await firstValueFrom(storage.add(record));

    const restore = abortTransactionAfterDeleteSucceeds();
    try {
      await expect(firstValueFrom(storage.remove('abort-remove'))).rejects.toBeDefined();
    } finally {
      restore();
    }

    const fresh = new IndexedDbOutboxStorage();
    const all = await firstValueFrom(fresh.getAll());
    expect(all.map((r) => r.localId)).toContain('abort-remove');
  });
});

// RR-9 item 1 regression (docs/reviews/write-outbox.md "Re-review 1", blocking item 1; D11's
// "emits once (or errors), and completes" contract; DoD [AC7] and section 6.1): a synchronous
// throw while `withStore` is *setting up* the transaction -- most notably `db.transaction(...)`
// raising `InvalidStateError` on a connection the browser has force-closed -- must reject the
// Observable rather than leave it silently pending forever. Against the pre-fix `withStore`
// (`this.open().then(onFulfilled, fail)` with no try/catch around `onFulfilled`, and no
// `db.onclose` handler at all), that throw rejects the promise `.then` returns, and nothing ever
// observes that rejection: the subscriber gets no `next`, no `error` and no `complete`. Every
// assertion below is a bounded `Promise.race` against a sentinel, not a bare `await`, precisely so
// a reintroduced hang fails the assertion instead of the test runner's own timeout.
describe('[AC7] IndexedDbOutboxStorage rejects rather than hangs on a transaction-setup throw (RR-9 item 1)', () => {
  let storage: IndexedDbOutboxStorage;
  const HANG = Symbol('hang');

  beforeEach(async () => {
    await deleteDb();
    TestBed.configureTestingModule({ providers: [IndexedDbOutboxStorage] });
    storage = TestBed.inject(IndexedDbOutboxStorage);
  });

  afterEach(async () => {
    await deleteDb();
  });

  async function assertRejectsWithinBudget(obs: Observable<unknown>, budgetMs = 1500): Promise<void> {
    const outcome = await Promise.race([
      firstValueFrom(obs).then(
        () => {
          throw new Error('expected the Observable to reject, but it resolved');
        },
        (e: unknown) => e
      ),
      new Promise<typeof HANG>((resolve) => setTimeout(() => resolve(HANG), budgetMs))
    ]);
    // A hang means `outcome === HANG`: the race's non-sentinel branch never won because nothing --
    // not `next`, not `error`, not `complete` -- ever reached the subscriber. Against the pre-fix
    // code this is exactly what happens: `db.transaction(...)`'s throw escapes both `fail`
    // handlers as an unobserved promise rejection.
    expect(outcome).not.toBe(HANG);
  }

  it('should_reject_rather_than_hang_when_db_transaction_throws_InvalidStateError_during_getAll', async () => {
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
      throw new DOMException('closed', 'InvalidStateError');
    });
    try {
      await assertRejectsWithinBudget(storage.getAll());
    } finally {
      spy.mockRestore();
    }
  });

  it('should_reject_rather_than_hang_when_db_transaction_throws_InvalidStateError_during_add', async () => {
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
      throw new DOMException('closed', 'InvalidStateError');
    });
    try {
      await assertRejectsWithinBudget(storage.add(makeRecord({ localId: 'setup-throw-add' })));
    } finally {
      spy.mockRestore();
    }
  });

  it('should_reject_rather_than_hang_when_db_transaction_throws_InvalidStateError_during_updateStatus', async () => {
    // The connection is healthy for this seed write; only the later `updateStatus` call sees the
    // throw, via `mockImplementationOnce`.
    const record = makeRecord({ localId: 'setup-throw-update' });
    await firstValueFrom(storage.add(record));

    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => {
      throw new DOMException('closed', 'InvalidStateError');
    });
    try {
      await assertRejectsWithinBudget(storage.updateStatus('setup-throw-update', { status: 'failed' }));
    } finally {
      spy.mockRestore();
    }
  });

  it('should_reject_rather_than_hang_when_db_transaction_throws_InvalidStateError_during_remove', async () => {
    const record = makeRecord({ localId: 'setup-throw-remove' });
    await firstValueFrom(storage.add(record));

    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => {
      throw new DOMException('closed', 'InvalidStateError');
    });
    try {
      await assertRejectsWithinBudget(storage.remove('setup-throw-remove'));
    } finally {
      spy.mockRestore();
    }
  });

  it('should_reject_rather_than_hang_when_db_transaction_throws_a_plain_error_not_InvalidStateError', async () => {
    // Exercises the generic try/catch alone: a plain `Error` is not a `DOMException` named
    // `InvalidStateError`, so the dedicated cache-reset branch must not fire, but the throw must
    // still reach `fail` rather than escape it.
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => {
      throw new Error('synthetic transaction-setup failure');
    });
    try {
      await assertRejectsWithinBudget(storage.getAll());
    } finally {
      spy.mockRestore();
    }

    // The generic throw must not have reset the cached connection (only `InvalidStateError`
    // does): the very next call reuses it, with no second `indexedDB.open`.
    const openSpy = vi.spyOn(indexedDB, 'open');
    await firstValueFrom(storage.getAll());
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('should_reject_rather_than_hang_when_transaction_objectStore_throws_synchronously', async () => {
    // A throw one line later in the same `try` block -- `transaction.objectStore(...)` rather than
    // `db.transaction(...)` -- must be caught by the same generic try/catch.
    const spy = vi.spyOn(IDBTransaction.prototype, 'objectStore').mockImplementationOnce(() => {
      throw new Error('synthetic objectStore failure');
    });
    try {
      await assertRejectsWithinBudget(storage.add(makeRecord({ localId: 'objectStore-throw' })));
    } finally {
      spy.mockRestore();
    }
  });
});

// RR-9 item 1 regression, continued: after the connection the storage caches is force-closed, the
// next operation must reopen rather than keep throwing against (or hanging on) the dead
// connection. Against the pre-fix code there is no `db.onclose` handler at all, so `dbPromise`
// keeps resolving to the closed connection forever, and the missing try/catch around
// `db.transaction(...)` means every later operation would hang rather than even error.
describe('[AC7] IndexedDbOutboxStorage reopens after the browser force-closes the connection (RR-9 item 1)', () => {
  let storage: IndexedDbOutboxStorage;

  beforeEach(async () => {
    await deleteDb();
    TestBed.configureTestingModule({ providers: [IndexedDbOutboxStorage] });
    storage = TestBed.inject(IndexedDbOutboxStorage);
  });

  afterEach(async () => {
    await deleteDb();
  });

  it('should_reopen_and_succeed_when_the_next_operation_runs_after_the_connection_is_force_closed', async () => {
    const originalOpen = indexedDB.open.bind(indexedDB);
    let capturedDb: IDBDatabase | undefined;
    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementation((name: string, version?: number) => {
      const request = originalOpen(name, version);
      request.addEventListener('success', () => {
        capturedDb = request.result;
      });
      return request;
    });

    try {
      await firstValueFrom(storage.add(makeRecord({ localId: 'before-close' })));
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(capturedDb).toBeDefined();

      // Real browsers don't dispatch `close` from calling `db.close()` yourself; this simulates
      // the browser force-closing the connection out from under the page (e.g. site data
      // cleared), which `IDBDatabase`, being an `EventTarget`, delivers to `onclose` the same way.
      capturedDb!.dispatchEvent(new Event('close'));

      const HANG = Symbol('hang');
      const outcome = await Promise.race([
        firstValueFrom(storage.add(makeRecord({ localId: 'after-close' }))).then(
          () => 'resolved' as const,
          (e: unknown) => e
        ),
        new Promise<typeof HANG>((resolve) => setTimeout(() => resolve(HANG), 1500))
      ]);
      // Against the pre-fix code (no `onclose` handler, no try/catch) this hangs: `dbPromise`
      // still holds the closed connection, `db.transaction(...)` throws `InvalidStateError`
      // synchronously on it, and that throw escapes unobserved.
      expect(outcome).toBe('resolved');
      expect(openSpy).toHaveBeenCalledTimes(2); // reopened for the post-close write
    } finally {
      openSpy.mockRestore();
    }

    const all = await firstValueFrom(storage.getAll());
    expect(all.map((r) => r.localId).sort()).toEqual(['after-close', 'before-close']);

    // Durable beyond this instance's own cache, from a fresh connection.
    const fresh = new IndexedDbOutboxStorage();
    const allFresh = await firstValueFrom(fresh.getAll());
    expect(allFresh.map((r) => r.localId)).toContain('after-close');
  });

  it('should_not_discard_a_newer_cached_connection_when_a_stale_connections_close_event_fires_late', async () => {
    await firstValueFrom(storage.add(makeRecord({ localId: 'gen-a' })));

    const internal = storage as unknown as { dbPromise?: Promise<IDBDatabase> };
    const staleDbPromise = internal.dbPromise;
    expect(staleDbPromise).toBeDefined();
    const staleDb = await staleDbPromise!;

    // Force a reopen so a *different* promise/connection becomes the cached one, simulating a
    // newer `open()` call having already superseded the one whose `close` is about to fire late.
    internal.dbPromise = undefined;
    await firstValueFrom(storage.add(makeRecord({ localId: 'gen-b' })));
    const newerDbPromise = internal.dbPromise;
    expect(newerDbPromise).toBeDefined();
    expect(newerDbPromise).not.toBe(staleDbPromise);

    staleDb.dispatchEvent(new Event('close'));

    expect(internal.dbPromise).toBe(newerDbPromise); // unaffected by the stale connection's event

    const all = await firstValueFrom(storage.getAll());
    expect(all.map((r) => r.localId)).toContain('gen-b');
  });
});
