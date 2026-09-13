import { EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { OutboxRecord } from 'src/shared/models';
import { OutboxActions } from './outbox.actions';
import { OutboxState } from './outbox.model';

export const outboxAdapter: EntityAdapter<OutboxRecord> = createEntityAdapter<OutboxRecord>({
  selectId: (record) => record.localId,
  sortComparer: (a, b) => a.enqueuedAt - b.enqueuedAt || a.localId.localeCompare(b.localId)
});

export const outboxInitialState: OutboxState = outboxAdapter.getInitialState({ draining: false });

export const outboxReducer = createReducer(
  outboxInitialState,
  on(OutboxActions.hydrated, (state, { records }) => outboxAdapter.setAll(records, state)),
  on(OutboxActions.enqueued, (state, { record }) => outboxAdapter.addOne(record, state)),
  on(OutboxActions.attemptStarted, (state) => ({ ...state, draining: true })),
  on(OutboxActions.succeeded, (state, { localId }) => outboxAdapter.removeOne(localId, state)),
  on(OutboxActions.retryableFailed, (state, { localId, attempts, lastError }) =>
    outboxAdapter.updateOne({ id: localId, changes: { status: 'pending', attempts, lastError } }, state)
  ),
  on(OutboxActions.terminallyFailed, (state, { localId, attempts, lastError, failure }) =>
    outboxAdapter.updateOne({ id: localId, changes: { status: 'failed', attempts, lastError, failure } }, state)
  ),
  on(OutboxActions.drainCompleted, (state) => ({ ...state, draining: false }))
);
