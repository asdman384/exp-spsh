import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OutboxRecord } from 'src/shared/models';

import { IndexedDbOutboxStorage } from './indexed-db-outbox-storage.service';

export type OutboxRecordPatch = Partial<Pick<OutboxRecord, 'status' | 'attempts' | 'lastError' | 'failure'>>;

/**
 * Async persistence for the write outbox (`docs/specs/write-outbox.md` D11). Carries its own
 * root default binding to `IndexedDbOutboxStorage`, the same "abstract class as DI token" idea
 * as `StorageService` / `AbstractSecurityService`, but resolved here rather than in
 * `app.config.ts` so an unmodified `app.effects.spec.ts` TestBed (which provides no
 * `OutboxStorage`) can still build `AppEffects`.
 *
 * Every operation is a cold `Observable` that emits once (or errors) and completes. One
 * instance runs its operations strictly in subscription order.
 */
@Injectable({ providedIn: 'root', useFactory: () => inject(IndexedDbOutboxStorage) })
export abstract class OutboxStorage {
  /** Synchronous capability probe: `indexedDB` and `crypto.randomUUID` must both exist. */
  abstract isAvailable(): boolean;
  abstract getAll(): Observable<Array<OutboxRecord>>;
  /** Errors if `record.localId` already exists. */
  abstract add(record: OutboxRecord): Observable<void>;
  /** Completes quietly if `localId` is absent. */
  abstract updateStatus(localId: string, patch: OutboxRecordPatch): Observable<void>;
  /** Completes quietly if `localId` is absent. */
  abstract remove(localId: string): Observable<void>;
}
