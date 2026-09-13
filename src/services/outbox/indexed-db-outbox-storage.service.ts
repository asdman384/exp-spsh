import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OutboxRecord } from 'src/shared/models';

// Type-only import, so this file never references `OutboxStorage` at runtime: `outbox-storage.ts`
// imports this file's class as its root default binding, and a runtime import back would create
// a module-load-time TDZ cycle (docs/specs/write-outbox.md D11). A plain (non-`type`) import
// would still work under `tsc`'s own type-aware elision, but the production build's per-file
// transform (esbuild) cannot tell a type-only usage from a real one without an explicit `type`
// keyword, so it would keep the import and reintroduce the cycle.
import type { OutboxRecordPatch, OutboxStorage } from './outbox-storage';

const DB_NAME = 'exp-spsh-outbox';
const DB_VERSION = 1;
const STORE_NAME = 'writes';

/**
 * Raw IndexedDB, no library. Database `exp-spsh-outbox`, version 1, one object store `writes`
 * keyed by `localId`. The connection opens lazily -- never in the constructor -- and closes
 * itself on `versionchange` so a `deleteDatabase` from tests or DevTools isn't blocked.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbOutboxStorage implements OutboxStorage {
  private dbPromise: Promise<IDBDatabase> | undefined;

  isAvailable(): boolean {
    return typeof indexedDB !== 'undefined' && typeof crypto?.randomUUID === 'function';
  }

  getAll(): Observable<Array<OutboxRecord>> {
    return this.withStore('readonly', (store) => requestToPromise<Array<OutboxRecord>>(store.getAll()));
  }

  add(record: OutboxRecord): Observable<void> {
    return this.withStore('readwrite', async (store) => {
      await requestToPromise(store.add(record));
    });
  }

  updateStatus(localId: string, patch: OutboxRecordPatch): Observable<void> {
    return this.withStore('readwrite', async (store) => {
      const existing = await requestToPromise<OutboxRecord | undefined>(store.get(localId));
      if (!existing) {
        return;
      }
      await requestToPromise(store.put({ ...existing, ...patch }));
    });
  }

  remove(localId: string): Observable<void> {
    return this.withStore('readwrite', async (store) => {
      await requestToPromise(store.delete(localId));
    });
  }

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      const dbPromise: Promise<IDBDatabase> = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          // Only drop the cache if it still points at *this* connection: `open()` may already
          // have been called again (and `this.dbPromise` reassigned) by the time either handler
          // below fires, and a newer connection must never be discarded.
          const resetIfCurrent = () => {
            if (this.dbPromise === dbPromise) {
              this.dbPromise = undefined;
            }
          };
          db.onversionchange = () => {
            db.close();
            resetIfCurrent();
          };
          // The browser can force-close a connection outright (e.g. site data is cleared while
          // the tab is open) without a preceding `versionchange`; `close` is the only signal for
          // that, so the next operation must reopen rather than keep using the dead connection.
          db.onclose = resetIfCurrent;
          resolve(db);
        };
        request.onerror = () => reject(request.error as unknown);
      });
      this.dbPromise = dbPromise;
    }
    return this.dbPromise;
  }

  // Settles only on the transaction's `complete` event, never on the request's own `success`, so
  // a commit-time abort or error (quota, I/O, forced close) reaches the subscriber's error
  // channel instead of being reported as success (docs/specs/write-outbox.md D11, D4).
  private withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => Promise<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      let settled = false;
      const fail = (e: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        subscriber.error(e);
      };

      const opened = this.open();
      opened.then((db) => {
        // Everything here can throw synchronously -- most notably `db.transaction(...)` raising
        // `InvalidStateError` when the browser has closed `db` -- and a throw inside a `.then`
        // fulfilment callback only rejects the (unobserved) promise `.then` returns. Route every
        // such throw to the same once-only `fail`, exactly like the async rejection paths below.
        try {
          const transaction = db.transaction(STORE_NAME, mode);
          const store = transaction.objectStore(STORE_NAME);
          let result: T;

          transaction.oncomplete = () => {
            if (settled) {
              return;
            }
            settled = true;
            subscriber.next(result);
            subscriber.complete();
          };
          transaction.onabort = () => fail(transaction.error ?? new Error('IndexedDB transaction aborted'));
          transaction.onerror = () => fail(transaction.error ?? new Error('IndexedDB transaction error'));

          work(store).then((r) => {
            result = r;
          }, fail);
        } catch (e) {
          // `InvalidStateError` here means the cached connection is unusable (already closed or
          // closing); drop it so the next operation reopens instead of throwing the same way
          // forever. Guarded the same as `onclose`, so a newer connection is never discarded.
          if (this.dbPromise === opened && e instanceof DOMException && e.name === 'InvalidStateError') {
            this.dbPromise = undefined;
          }
          fail(e);
        }
      }, fail);
    });
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error as unknown);
  });
}
