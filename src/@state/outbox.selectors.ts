import { createFeatureSelector, createSelector } from '@ngrx/store';

import { outboxAdapter } from './outbox.reducers';
import { OutboxState } from './outbox.model';

const selectOutboxFeature = createFeatureSelector<OutboxState>('outbox');
const { selectAll } = outboxAdapter.getSelectors();

const outboxRecordsSelector = createSelector(selectOutboxFeature, selectAll);

export const pendingCountSelector = createSelector(
  outboxRecordsSelector,
  (records) => records.filter((record) => record.status === 'pending').length
);

export const failedCountSelector = createSelector(
  outboxRecordsSelector,
  (records) => records.filter((record) => record.status === 'failed').length
);

// `outboxRecordsSelector` is already ordered by the adapter's `sortComparer`, so the first
// match is the oldest.
export const oldestFailedSelector = createSelector(outboxRecordsSelector, (records) =>
  records.find((record) => record.status === 'failed')
);

export const isDrainingSelector = createSelector(selectOutboxFeature, (state) => state.draining);
