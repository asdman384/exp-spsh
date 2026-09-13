import 'src/logger';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action, Store } from '@ngrx/store';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { NetworkStatusService, OutboxStorage, SpreadsheetService } from 'src/services';
import { Expense } from 'src/shared/models';

import { AppActions } from './app.actions';
import { AppEffects } from './app.effects';
import { OutboxActions } from './outbox.actions';
import { pendingCountSelector } from './outbox.selectors';
import { FAILURE_MESSAGES } from './report-failure';

// [AC19] AppEffects.addExpense$ routing (D5), covering every branch in [AC15]-[AC17]. Follows the
// `app.effects.spec.ts` [AC16] precedent: the `Store` stub's `select` must return an Observable
// keyed by selector *reference* (here `pendingCountSelector`), since `AppEffects`'s field
// initializers call `this.store.select(...)` synchronously during construction, and `tap(log)`
// runs synchronously too -- hence the `globalThis.log` install via `import 'src/logger'`.
function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    category: 'Food',
    comment: 'lunch',
    amount: 12.5,
    date: new Date(2024, 0, 16, 12, 14, 23),
    isInDebt: false,
    ...overrides
  };
}

describe('[AC19] AppEffects.addExpense$ routing', () => {
  let actions$: Subject<Action>;
  let dispatch: ReturnType<typeof vi.fn>;
  let addExpense: ReturnType<typeof vi.fn>;
  let getSpreadsheetId: ReturnType<typeof vi.fn>;
  let isAvailable: ReturnType<typeof vi.fn>;
  let online$: BehaviorSubject<boolean>;
  let pending$: BehaviorSubject<number>;
  let effects: AppEffects;

  function configure(): void {
    actions$ = new Subject<Action>();
    dispatch = vi.fn();
    addExpense = vi.fn();
    getSpreadsheetId = vi.fn().mockReturnValue('spsh-1');
    isAvailable = vi.fn().mockReturnValue(true);
    online$ = new BehaviorSubject<boolean>(true);
    pending$ = new BehaviorSubject<number>(0);

    const select = vi.fn((selector: unknown) => {
      if (selector === pendingCountSelector) return pending$;
      return of(undefined);
    });

    const storeStub: Pick<Store, 'select' | 'dispatch'> = {
      select: select as unknown as Store['select'],
      dispatch: dispatch as unknown as Store['dispatch']
    };
    const networkStub: Pick<NetworkStatusService, 'online$'> = { online$ };
    const spreadsheetStub = { getSpreadsheetId, addExpense } as unknown as SpreadsheetService;
    const outboxStorageStub = { isAvailable } as unknown as OutboxStorage;
    const snackBarStub: Pick<MatSnackBar, 'open'> = { open: vi.fn() as unknown as MatSnackBar['open'] };

    TestBed.configureTestingModule({
      providers: [
        AppEffects,
        provideMockActions(() => actions$),
        { provide: Store, useValue: storeStub },
        { provide: NetworkStatusService, useValue: networkStub },
        { provide: SpreadsheetService, useValue: spreadsheetStub },
        { provide: MatSnackBar, useValue: snackBarStub },
        { provide: OutboxStorage, useValue: outboxStorageStub }
      ]
    });

    effects = TestBed.inject(AppEffects);
  }

  beforeEach(() => configure());

  // --- [AC15] branch: storage unavailable / empty spreadsheet id -> today's unchanged path ---

  it('should_take_the_live_path_and_never_enqueue_when_storage_is_unavailable', () => {
    isAvailable.mockReturnValue(false);
    addExpense.mockReturnValue(of({}));
    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    const expense = makeExpense();
    actions$.next(AppActions.addExpense({ sheetId: 3, expense }));

    expect(addExpense).toHaveBeenCalledWith(3, expense);
    expect(dispatch).toHaveBeenCalledWith(AppActions.loading({ loading: true }));
    expect(emitted.some((a) => a.type === OutboxActions.enqueue.type)).toBe(false);
  });

  it('should_take_the_live_path_when_the_spreadsheet_id_is_empty_even_if_storage_is_available', () => {
    getSpreadsheetId.mockReturnValue('');
    addExpense.mockReturnValue(of({}));
    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    actions$.next(AppActions.addExpense({ sheetId: 3, expense: makeExpense() }));

    expect(addExpense).toHaveBeenCalledTimes(1);
    expect(emitted.some((a) => a.type === OutboxActions.enqueue.type)).toBe(false);
  });

  it('should_dispatch_loadExpenses_for_the_next_day_window_on_a_successful_live_send_when_storage_is_unavailable', () => {
    isAvailable.mockReturnValue(false);
    addExpense.mockReturnValue(of({}));
    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    const expense = makeExpense();
    actions$.next(AppActions.addExpense({ sheetId: 4, expense }));

    expect(emitted).toHaveLength(1);
    const action = emitted[0] as ReturnType<typeof AppActions.loadExpenses>;
    expect(action.type).toBe(AppActions.loadExpenses.type);
    expect(action.sheetId).toBe(4);
    expect(action.from).toEqual(expense.date);
    const expectedTo = new Date(expense.date!);
    expectedTo.setDate(expectedTo.getDate() + 1);
    expect(action.to).toEqual(expectedTo);
  });

  it('should_report_failure_and_not_enqueue_when_the_live_send_fails_terminal_and_storage_is_unavailable', () => {
    isAvailable.mockReturnValue(false);
    addExpense.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    actions$.next(AppActions.addExpense({ sheetId: 5, expense: makeExpense() }));

    expect(dispatch).toHaveBeenCalledWith(AppActions.loading({ loading: false }));
    expect(dispatch).toHaveBeenCalledWith(
      AppActions.operationFailed({ source: 'addExpense$', message: FAILURE_MESSAGES.addExpense$ })
    );
    expect(emitted.some((a) => a.type === OutboxActions.enqueue.type)).toBe(false);
  });

  // --- [AC15] branch: offline -> enqueue(drain:false), no call ---

  it('should_enqueue_with_drain_false_and_not_call_addExpense_when_offline', () => {
    online$.next(false);
    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    actions$.next(AppActions.addExpense({ sheetId: 5, expense: makeExpense() }));

    expect(addExpense).not.toHaveBeenCalled();
    expect(emitted).toHaveLength(1);
    const action = emitted[0] as ReturnType<typeof OutboxActions.enqueue>;
    expect(action.type).toBe(OutboxActions.enqueue.type);
    expect(action.drain).toBe(false);
  });

  it('should_dispatch_no_loading_action_on_the_offline_proactive_enqueue_path', () => {
    online$.next(false);
    effects.addExpense$.subscribe();

    actions$.next(AppActions.addExpense({ sheetId: 1, expense: makeExpense() }));

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: AppActions.loading.type }));
  });

  // --- [AC15] branch: online, pending > 0 -> enqueue(drain:true), no call ---

  it('should_enqueue_with_drain_true_and_not_call_addExpense_when_pending_count_is_greater_than_zero', () => {
    pending$.next(2);
    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    actions$.next(AppActions.addExpense({ sheetId: 5, expense: makeExpense() }));

    expect(addExpense).not.toHaveBeenCalled();
    expect(emitted).toHaveLength(1);
    const action = emitted[0] as ReturnType<typeof OutboxActions.enqueue>;
    expect(action.drain).toBe(true);
  });

  it('should_dispatch_no_loading_action_on_the_behind_queue_proactive_enqueue_path', () => {
    pending$.next(1);
    effects.addExpense$.subscribe();

    actions$.next(AppActions.addExpense({ sheetId: 1, expense: makeExpense() }));

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: AppActions.loading.type }));
  });

  // --- [AC15] branch: online, 0 pending -> live call ---

  it('should_call_addExpense_live_when_online_with_zero_pending', () => {
    addExpense.mockReturnValue(of({}));
    effects.addExpense$.subscribe();

    actions$.next(AppActions.addExpense({ sheetId: 5, expense: makeExpense() }));

    expect(addExpense).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(AppActions.loading({ loading: true }));
  });

  // --- [AC15]/[AC17] branch: live error retryable/auth -> loading(false) then enqueue(drain:false) ---

  it('should_dispatch_loading_false_before_emitting_enqueue_drain_false_when_the_live_send_fails_retryable', () => {
    const order: Array<string> = [];
    dispatch.mockImplementation((action: Action) => order.push(`dispatch:${action.type}`));
    addExpense.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    effects.addExpense$.subscribe((a) => order.push(`emit:${a.type}`));

    actions$.next(AppActions.addExpense({ sheetId: 5, expense: makeExpense() }));

    expect(order).toEqual([
      `dispatch:${AppActions.loading.type}`, // loading(true) at send start
      `dispatch:${AppActions.loading.type}`, // loading(false) on failure
      `emit:${OutboxActions.enqueue.type}`
    ]);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: AppActions.operationFailed.type }));
  });

  it('should_dispatch_loading_false_before_emitting_enqueue_drain_false_when_the_live_send_fails_auth_401', () => {
    const order: Array<string> = [];
    dispatch.mockImplementation((action: Action) => order.push(`dispatch:${action.type}`));
    addExpense.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    effects.addExpense$.subscribe((a) => order.push(`emit:${a.type}`));

    actions$.next(AppActions.addExpense({ sheetId: 5, expense: makeExpense() }));

    expect(order).toEqual([
      `dispatch:${AppActions.loading.type}`,
      `dispatch:${AppActions.loading.type}`,
      `emit:${OutboxActions.enqueue.type}`
    ]);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: AppActions.operationFailed.type }));
  });

  it('should_dispatch_loading_false_exactly_once_on_the_reactive_enqueue_path', () => {
    addExpense.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    effects.addExpense$.subscribe();

    actions$.next(AppActions.addExpense({ sheetId: 1, expense: makeExpense() }));

    const loadingFalseCalls = dispatch.mock.calls.filter(
      ([action]) =>
        (action as Action).type === AppActions.loading.type &&
        (action as ReturnType<typeof AppActions.loading>).loading === false
    );
    expect(loadingFalseCalls).toHaveLength(1);
  });

  // --- [AC15] branch: live error terminal -> reportFailure, no enqueue ---

  it('should_report_failure_and_not_enqueue_when_the_live_send_fails_terminal', () => {
    addExpense.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    actions$.next(AppActions.addExpense({ sheetId: 5, expense: makeExpense() }));

    expect(dispatch).toHaveBeenCalledWith(AppActions.loading({ loading: false }));
    expect(dispatch).toHaveBeenCalledWith(
      AppActions.operationFailed({ source: 'addExpense$', message: FAILURE_MESSAGES.addExpense$ })
    );
    expect(emitted.some((a) => a.type === OutboxActions.enqueue.type)).toBe(false);
  });

  // --- [AC16]: enqueued record shape ---

  it('should_enqueue_a_record_with_exactly_the_five_expense_keys_and_no_extra_sheet_field_attempts_0', () => {
    online$.next(false);
    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    // Simulate the dashboard form's runtime shape, which carries an extra `sheet` object never
    // reflected in `Expense`'s static type (D10).
    const expenseWithSheet = { ...makeExpense(), sheet: { id: 1, title: 'Sheet1' } } as unknown as Expense;
    actions$.next(AppActions.addExpense({ sheetId: 9, expense: expenseWithSheet }));

    expect(emitted).toHaveLength(1);
    const action = emitted[0] as ReturnType<typeof OutboxActions.enqueue>;
    expect(Object.keys(action.record.payload.expense).sort()).toEqual(
      ['amount', 'category', 'comment', 'date', 'isInDebt'].sort()
    );
    expect(action.record.kind).toBe('addExpense');
    expect(action.record.spreadsheetId).toBe('spsh-1');
    expect(action.record.payload.sheetId).toBe(9);
    expect(action.record.status).toBe('pending');
    expect(action.record.attempts).toBe(0);
    expect(typeof action.record.enqueuedAt).toBe('number');
    expect(action.record.localId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('should_enqueue_a_record_with_attempts_1_and_lastError_set_on_the_reactive_path', () => {
    addExpense.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0, statusText: 'offline' })));
    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    actions$.next(AppActions.addExpense({ sheetId: 2, expense: makeExpense() }));

    const enqueueAction = emitted.find((a) => a.type === OutboxActions.enqueue.type) as ReturnType<
      typeof OutboxActions.enqueue
    >;
    expect(enqueueAction.record.attempts).toBe(1);
    expect(enqueueAction.record.lastError).toBeTruthy();
    expect(enqueueAction.drain).toBe(false);
  });

  // --- R-1 regression (docs/reviews/write-outbox.md Required 1): the reactive enqueue must
  // capture spreadsheetId/enqueuedAt at routing time, not when the failed request's catchError
  // runs. Against the pre-fix code, `buildRecord`'s identity default parameter is evaluated
  // inside `catchError`, i.e. AFTER the in-flight request fails, so it would read whatever
  // `getSpreadsheetId()`/`Date.now()` return at that later moment -- 'spsh-2'/2000 below -- and
  // this test would fail. The fixed code snapshots `identity` before `addExpense(...)` is called.

  it('should_enqueue_with_the_routing_time_spreadsheetId_and_enqueuedAt_when_a_retryable_error_arrives_after_a_spreadsheet_switch', () => {
    const request$ = new Subject<unknown>();
    addExpense.mockReturnValue(request$);
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    getSpreadsheetId.mockReturnValue('spsh-1');

    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    actions$.next(AppActions.addExpense({ sheetId: 5, expense: makeExpense() }));

    // The request is now in flight (held open by the Subject). Simulate a spreadsheet switch in
    // Setup and the passage of time while it hangs.
    getSpreadsheetId.mockReturnValue('spsh-2');
    now.mockReturnValue(2000);

    request$.error(new HttpErrorResponse({ status: 0 }));

    const enqueueAction = emitted.find((a) => a.type === OutboxActions.enqueue.type) as ReturnType<
      typeof OutboxActions.enqueue
    >;
    expect(enqueueAction).toBeDefined();
    expect(enqueueAction.record.spreadsheetId).toBe('spsh-1');
    expect(enqueueAction.record.enqueuedAt).toBe(1000);

    now.mockRestore();
  });

  it('should_enqueue_with_the_routing_time_spreadsheetId_and_enqueuedAt_when_an_auth_401_error_arrives_after_a_spreadsheet_switch', () => {
    const request$ = new Subject<unknown>();
    addExpense.mockReturnValue(request$);
    const now = vi.spyOn(Date, 'now').mockReturnValue(3000);
    getSpreadsheetId.mockReturnValue('spsh-A');

    const emitted: Array<Action> = [];
    effects.addExpense$.subscribe((a) => emitted.push(a));

    actions$.next(AppActions.addExpense({ sheetId: 6, expense: makeExpense() }));

    getSpreadsheetId.mockReturnValue('spsh-B');
    now.mockReturnValue(4000);

    request$.error(new HttpErrorResponse({ status: 401 }));

    const enqueueAction = emitted.find((a) => a.type === OutboxActions.enqueue.type) as ReturnType<
      typeof OutboxActions.enqueue
    >;
    expect(enqueueAction).toBeDefined();
    expect(enqueueAction.record.spreadsheetId).toBe('spsh-A');
    expect(enqueueAction.record.enqueuedAt).toBe(3000);

    now.mockRestore();
  });
});
