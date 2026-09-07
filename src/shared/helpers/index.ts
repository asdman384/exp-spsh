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
