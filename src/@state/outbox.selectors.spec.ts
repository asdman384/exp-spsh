import { OutboxRecord } from 'src/shared/models';
import { OutboxState } from './outbox.model';
import { outboxAdapter, outboxInitialState } from './outbox.reducers';
import {
  failedCountSelector,
  isDrainingSelector,
  oldestFailedSelector,
  pendingCountSelector
} from './outbox.selectors';

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

function buildState(records: Array<OutboxRecord>, draining = false): { outbox: OutboxState } {
  return { outbox: outboxAdapter.setAll(records, { ...outboxInitialState, draining }) };
}

// [AC6] selectors built on the real outbox feature state (also exercises [AC4]).
describe('[AC6] outbox selectors', () => {
  it('should_count_only_pending_records_for_pendingCountSelector_ignoring_failed_ones', () => {
    const state = buildState([
      makeRecord({ localId: 'a', status: 'pending' }),
      makeRecord({ localId: 'b', status: 'failed' }),
      makeRecord({ localId: 'c', status: 'pending' })
    ]);

    expect(pendingCountSelector(state)).toBe(2);
  });

  it('should_count_only_failed_records_for_failedCountSelector', () => {
    const state = buildState([
      makeRecord({ localId: 'a', status: 'pending' }),
      makeRecord({ localId: 'b', status: 'failed' }),
      makeRecord({ localId: 'c', status: 'failed' })
    ]);

    expect(failedCountSelector(state)).toBe(2);
  });

  it('should_pick_the_earliest_failed_record_in_comparator_order_for_oldestFailedSelector', () => {
    const late = makeRecord({ localId: 'z', enqueuedAt: 2000, status: 'failed' });
    const early = makeRecord({ localId: 'a', enqueuedAt: 1000, status: 'failed' });
    const evenEarlierButPending = makeRecord({ localId: 'p', enqueuedAt: 500, status: 'pending' });
    const state = buildState([late, evenEarlierButPending, early]);

    expect(oldestFailedSelector(state)?.localId).toBe('a');
  });

  it('should_return_undefined_from_oldestFailedSelector_when_no_failed_record_exists', () => {
    const state = buildState([makeRecord({ status: 'pending' })]);

    expect(oldestFailedSelector(state)).toBeUndefined();
  });

  it('should_reflect_the_draining_flag_via_isDrainingSelector', () => {
    expect(isDrainingSelector(buildState([], true))).toBe(true);
    expect(isDrainingSelector(buildState([], false))).toBe(false);
  });
});
