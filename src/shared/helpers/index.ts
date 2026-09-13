import { HttpErrorResponse } from '@angular/common/http';
import { Expense } from '../models';

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export function toMessage(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    const envelopeMessage: unknown = e.error?.error?.message;
    if (typeof envelopeMessage === 'string' && envelopeMessage) {
      return envelopeMessage;
    }
    return `${e.status} ${e.statusText}`;
  }
  if (typeof e === 'string') {
    return e || GENERIC_ERROR_MESSAGE;
  }
  if (e instanceof Error) {
    return e.message || GENERIC_ERROR_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

const RETRYABLE_STATUSES = new Set([408, 429]);

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status) || (status >= 500 && status <= 599);
}

/**
 * Classifies an `addExpense` failure per `docs/specs/write-outbox.md` D3. Rules are checked in
 * order, first match wins.
 */
export function classifyWriteError(e: unknown): 'retryable' | 'auth' | 'terminal' {
  if (!(e instanceof HttpErrorResponse)) {
    return 'terminal';
  }
  if (e.status === 0) {
    return 'retryable';
  }
  if (e.url?.includes('oauth2.googleapis.com/token')) {
    return isRetryableStatus(e.status) ? 'retryable' : 'auth';
  }
  if (e.status === 401) {
    return 'auth';
  }
  if (isRetryableStatus(e.status)) {
    return 'retryable';
  }
  return 'terminal';
}

export function isExpenseEqual(e1: Expense, e2: Expense): boolean {
  return (
    e1.comment === e2.comment &&
    e1.category === e2.category &&
    e1.amount === e2.amount &&
    e1.date?.getSeconds() === e2.date?.getSeconds() &&
    e1.date?.getMinutes() === e2.date?.getMinutes() &&
    e1.date?.getHours() === e2.date?.getHours() &&
    e1.date?.getDate() === e2.date?.getDate() &&
    e1.date?.getMonth() === e2.date?.getMonth() &&
    e1.date?.getFullYear() === e2.date?.getFullYear() &&
    !!e1.isInDebt === !!e2.isInDebt
  );
}
