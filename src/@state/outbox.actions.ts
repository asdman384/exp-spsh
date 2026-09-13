import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { OutboxRecord } from 'src/shared/models';

export const OutboxActions = createActionGroup({
  source: 'Outbox',
  events: {
    // hydration
    hydrated: props<{ records: Array<OutboxRecord> }>(),

    // enqueue
    enqueue: props<{ record: OutboxRecord; drain: boolean }>(),
    enqueued: props<{ record: OutboxRecord }>(),

    // drain triggers
    drainRequested: emptyProps(),
    syncRequested: emptyProps(),

    // drain pass
    attemptStarted: props<{ localId: string }>(),
    succeeded: props<{ localId: string }>(),
    retryableFailed: props<{ localId: string; attempts: number; lastError: string }>(),
    terminallyFailed: props<{
      localId: string;
      attempts: number;
      lastError: string;
      failure: 'rejected' | 'otherSpreadsheet';
    }>(),
    drainCompleted: props<{
      sent: number;
      newlyFailed: number;
      remainingPending: number;
      lastSent: OutboxRecord | null;
    }>(),

    // failed-item resolution
    retry: props<{ localId: string }>(),
    discard: props<{ localId: string }>()
  }
});
