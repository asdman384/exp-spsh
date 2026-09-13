import { Expense } from './expense';

/**
 * A queued `addExpense` write, persisted in IndexedDB (`OutboxStorage`) and mirrored in the
 * `outbox` NgRx slice. See `docs/specs/write-outbox.md` D10.
 */
export interface OutboxRecord {
  localId: string;
  kind: 'addExpense';
  spreadsheetId: string;
  payload: { sheetId: number; expense: Expense };
  enqueuedAt: number;
  status: 'pending' | 'failed';
  attempts: number;
  lastError?: string;
  failure?: 'rejected' | 'otherSpreadsheet';
}
