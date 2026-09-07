import { EMPTY, Observable } from 'rxjs';

import { Store } from '@ngrx/store';
import { toMessage } from 'src/shared/helpers';
import { AppActions } from './app.actions';

export type FailureSource =
  | 'loadCategories$'
  | 'addCategory$'
  | 'deleteCategory$'
  | 'updateCategoryPosition$'
  | 'addExpense$'
  | 'deleteExpense$'
  | 'loadExpenses$';

export const FAILURE_MESSAGES: Record<FailureSource, string> = {
  loadCategories$: "Couldn't load your categories. Check your connection and try again.",
  addCategory$: "Couldn't add that category. Please try again.",
  deleteCategory$: "Couldn't delete that category. Please try again.",
  updateCategoryPosition$: "Couldn't save the new order. Your categories were put back the way they were.",
  addExpense$: "Couldn't save that expense. Please try again.",
  deleteExpense$: "Couldn't delete that expense. It's back in your list.",
  loadExpenses$: "Couldn't load your expenses. Check your connection and try again."
};

export function reportFailure(source: FailureSource, store: Store): (e: unknown) => Observable<never> {
  return (e: unknown) => {
    log(toMessage(e));
    store.dispatch(AppActions.loading({ loading: false }));
    store.dispatch(AppActions.operationFailed({ source, message: FAILURE_MESSAGES[source] }));
    return EMPTY;
  };
}
