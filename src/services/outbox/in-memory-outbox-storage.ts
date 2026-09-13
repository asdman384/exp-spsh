import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { OutboxRecord } from 'src/shared/models';

// Type-only import -- see the comment in indexed-db-outbox-storage.service.ts. This file is a
// test double only; it is never referenced by any production file (`app.config.ts`, effects,
// components).
import type { OutboxRecordPatch, OutboxStorage } from './outbox-storage';

/**
 * Test double for `OutboxStorage`, backed by an in-memory `Map`. `structuredClone` is used on
 * the way in and out because NgRx freezes actions/state in dev mode, and this double must catch
 * accidental mutation the same way the real, structured-clone-backed IndexedDB store would.
 */
@Injectable()
export class InMemoryOutboxStorage implements OutboxStorage {
  private readonly records = new Map<string, OutboxRecord>();

  isAvailable(): boolean {
    return true;
  }

  getAll(): Observable<Array<OutboxRecord>> {
    return of(Array.from(this.records.values()).map((record) => structuredClone(record)));
  }

  add(record: OutboxRecord): Observable<void> {
    if (this.records.has(record.localId)) {
      return throwError(() => new Error(`OutboxRecord [${record.localId}] already exists`));
    }
    this.records.set(record.localId, structuredClone(record));
    return of(undefined);
  }

  updateStatus(localId: string, patch: OutboxRecordPatch): Observable<void> {
    const existing = this.records.get(localId);
    if (existing) {
      this.records.set(localId, structuredClone({ ...existing, ...patch }));
    }
    return of(undefined);
  }

  remove(localId: string): Observable<void> {
    this.records.delete(localId);
    return of(undefined);
  }
}
