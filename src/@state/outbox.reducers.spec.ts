import { OutboxRecord } from 'src/shared/models';
import { OutboxActions } from './outbox.actions';
import { outboxInitialState, outboxReducer } from './outbox.reducers';

function makeRecord(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
  return {
    localId: 'id-1',
    kind: 'addExpense',
    spreadsheetId: 'spsh-1',
    payload: {
      sheetId: 0,
      expense: { date: new Date(2024, 0, 1), amount: 10, category: 'Food', comment: '', isInDebt: false }
    },
    enqueuedAt: 1000,
    status: 'pending',
    attempts: 0,
    ...overrides
  };
}

// [AC6] against the real reducer (also exercises [AC1]-[AC3]: shape, action group, and every
// reducer branch named in the spec).
describe('[AC6] outboxReducer', () => {
  it('should_start_with_an_empty_collection_and_draining_false', () => {
    expect(outboxInitialState.ids).toEqual([]);
    expect(outboxInitialState.entities).toEqual({});
    expect(outboxInitialState.draining).toBe(false);
  });

  it('should_replace_the_whole_collection_on_hydrated_dropping_ids_no_longer_present', () => {
    const withA = outboxReducer(outboxInitialState, OutboxActions.enqueued({ record: makeRecord({ localId: 'a' }) }));
    const b = makeRecord({ localId: 'b', enqueuedAt: 2000 });

    const hydrated = outboxReducer(withA, OutboxActions.hydrated({ records: [b] }));

    expect(hydrated.ids).toEqual(['b']);
    expect(hydrated.entities['a']).toBeUndefined();
    expect(hydrated.entities['b']).toEqual(b);
  });

  it('should_order_records_by_enqueuedAt_then_localId_even_when_added_out_of_order', () => {
    const late = makeRecord({ localId: 'z', enqueuedAt: 2000 });
    const early = makeRecord({ localId: 'a', enqueuedAt: 1000 });
    const tieHigh = makeRecord({ localId: 'm', enqueuedAt: 1500 });
    const tieLow = makeRecord({ localId: 'b', enqueuedAt: 1500 });

    const state = outboxReducer(outboxInitialState, OutboxActions.hydrated({ records: [late, tieHigh, early, tieLow] }));

    expect(state.ids).toEqual(['a', 'b', 'm', 'z']);
  });

  it('should_add_the_enqueued_record_via_addOne', () => {
    const record = makeRecord();

    const state = outboxReducer(outboxInitialState, OutboxActions.enqueued({ record }));

    expect(state.ids).toEqual([record.localId]);
    expect(state.entities[record.localId]).toEqual(record);
  });

  it('should_set_draining_true_on_attemptStarted_without_touching_the_collection', () => {
    const record = makeRecord();
    const seeded = outboxReducer(outboxInitialState, OutboxActions.enqueued({ record }));

    const state = outboxReducer(seeded, OutboxActions.attemptStarted({ localId: record.localId }));

    expect(state.draining).toBe(true);
    expect(state.entities[record.localId]).toEqual(record);
  });

  it('should_remove_the_record_via_removeOne_on_succeeded', () => {
    const record = makeRecord();
    const seeded = outboxReducer(outboxInitialState, OutboxActions.enqueued({ record }));

    const state = outboxReducer(seeded, OutboxActions.succeeded({ localId: record.localId }));

    expect(state.ids).toEqual([]);
    expect(state.entities[record.localId]).toBeUndefined();
  });

  it('should_update_attempts_and_lastError_and_keep_status_pending_on_retryableFailed', () => {
    const record = makeRecord();
    const seeded = outboxReducer(outboxInitialState, OutboxActions.enqueued({ record }));

    const state = outboxReducer(
      seeded,
      OutboxActions.retryableFailed({ localId: record.localId, attempts: 1, lastError: 'network down' })
    );

    expect(state.entities[record.localId]).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'network down'
    });
  });

  it('should_set_status_failed_with_attempts_lastError_and_failure_on_terminallyFailed', () => {
    const record = makeRecord();
    const seeded = outboxReducer(outboxInitialState, OutboxActions.enqueued({ record }));

    const state = outboxReducer(
      seeded,
      OutboxActions.terminallyFailed({ localId: record.localId, attempts: 2, lastError: '400 rejected', failure: 'rejected' })
    );

    expect(state.entities[record.localId]).toMatchObject({
      status: 'failed',
      attempts: 2,
      lastError: '400 rejected',
      failure: 'rejected'
    });
  });

  it('should_set_draining_false_on_drainCompleted', () => {
    const draining = outboxReducer(outboxInitialState, OutboxActions.attemptStarted({ localId: 'a' }));

    const state = outboxReducer(
      draining,
      OutboxActions.drainCompleted({ sent: 1, newlyFailed: 0, remainingPending: 0, lastSent: null })
    );

    expect(state.draining).toBe(false);
  });

  it('should_leave_state_unchanged_reference_for_enqueue', () => {
    const action = OutboxActions.enqueue({ record: makeRecord(), drain: true });
    expect(outboxReducer(outboxInitialState, action)).toBe(outboxInitialState);
  });

  it('should_leave_state_unchanged_reference_for_drainRequested', () => {
    expect(outboxReducer(outboxInitialState, OutboxActions.drainRequested())).toBe(outboxInitialState);
  });

  it('should_leave_state_unchanged_reference_for_syncRequested', () => {
    expect(outboxReducer(outboxInitialState, OutboxActions.syncRequested())).toBe(outboxInitialState);
  });

  it('should_leave_state_unchanged_reference_for_retry', () => {
    expect(outboxReducer(outboxInitialState, OutboxActions.retry({ localId: 'a' }))).toBe(outboxInitialState);
  });

  it('should_leave_state_unchanged_reference_for_discard', () => {
    expect(outboxReducer(outboxInitialState, OutboxActions.discard({ localId: 'a' }))).toBe(outboxInitialState);
  });

  it('should_never_mutate_the_input_state_object', () => {
    const record = makeRecord();
    const seeded = outboxReducer(outboxInitialState, OutboxActions.enqueued({ record }));
    const frozen = Object.freeze(seeded);
    Object.freeze(frozen.entities);

    expect(() => outboxReducer(frozen, OutboxActions.attemptStarted({ localId: record.localId }))).not.toThrow();
    // the frozen input itself must still read exactly as before -- proof nothing wrote through it.
    expect(frozen.draining).toBe(false);
    expect(frozen.entities[record.localId]).toEqual(record);
  });
});
