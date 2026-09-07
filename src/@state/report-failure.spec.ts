import { HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngrx/store';

// Side-effect import: production code (main.ts) dynamically imports this before bootstrap,
// which is how the global `log()` used by `reportFailure` gets installed. Tests don't go
// through main.ts, so this spec installs it the same way to exercise the real code path
// instead of stubbing `log` out.
import 'src/logger';

import { AppActions } from './app.actions';
import { FAILURE_MESSAGES, reportFailure } from './report-failure';

// [AC8] / [AC9] / [AC10]
describe('reportFailure', () => {
  function makeStore(): { store: Store; dispatch: ReturnType<typeof vi.fn> } {
    const dispatch = vi.fn();
    return { store: { dispatch } as unknown as Store, dispatch };
  }

  it('[AC8] FAILURE_MESSAGES contains the exact D4 copy for all 7 sources', () => {
    expect(FAILURE_MESSAGES).toEqual({
      loadCategories$: "Couldn't load your categories. Check your connection and try again.",
      addCategory$: "Couldn't add that category. Please try again.",
      deleteCategory$: "Couldn't delete that category. Please try again.",
      updateCategoryPosition$: "Couldn't save the new order. Your categories were put back the way they were.",
      addExpense$: "Couldn't save that expense. Please try again.",
      deleteExpense$: "Couldn't delete that expense. It's back in your list.",
      loadExpenses$: "Couldn't load your expenses. Check your connection and try again."
    });
  });

  it('[AC9] should_complete_without_emitting_and_dispatch_loading_false_then_operationFailed_in_order', () => {
    const { store, dispatch } = makeStore();
    let emitted = false;
    let completed = false;

    reportFailure('addCategory$', store)(new Error('boom')).subscribe({
      next: () => (emitted = true),
      complete: () => (completed = true)
    });

    expect(emitted).toBe(false);
    expect(completed).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(1, AppActions.loading({ loading: false }));
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      AppActions.operationFailed({ source: 'addCategory$', message: FAILURE_MESSAGES.addCategory$ })
    );
  });

  it('[AC9] should_dispatch_exact_source_and_message_payload_for_each_source', () => {
    const { store, dispatch } = makeStore();

    reportFailure('loadExpenses$', store)('some raw error').subscribe();

    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      AppActions.operationFailed({ source: 'loadExpenses$', message: FAILURE_MESSAGES.loadExpenses$ })
    );
  });

  it('[AC10] should_never_dispatch_the_raw_HttpErrorResponse_envelope_text_as_the_message', () => {
    const { store, dispatch } = makeStore();
    const rawEnvelopeMessage = 'Quota exceeded for quota metric X';
    const error = new HttpErrorResponse({
      status: 503,
      statusText: 'Service Unavailable',
      error: { error: { message: rawEnvelopeMessage } }
    });

    reportFailure('loadExpenses$', store)(error).subscribe();

    const operationFailedCall = dispatch.mock.calls[1][0] as { message: string };
    expect(operationFailedCall.message).toBe(FAILURE_MESSAGES.loadExpenses$);
    expect(operationFailedCall.message).not.toBe(rawEnvelopeMessage);
    expect(operationFailedCall.message).not.toContain('Quota exceeded');
  });
});
