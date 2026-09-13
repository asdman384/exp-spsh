import 'src/logger';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router } from '@angular/router';
import { ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action, Store } from '@ngrx/store';
import { BehaviorSubject, Observable, Subject, map, of, throwError } from 'rxjs';

import {
  AbstractSecurityService,
  IndexedDbOutboxStorage,
  NetworkStatusService,
  OutboxDrainLock,
  OutboxStorage,
  SpreadsheetService
} from 'src/services';
import { InMemoryOutboxStorage } from 'src/services/outbox/in-memory-outbox-storage';
import { OutboxRecord } from 'src/shared/models';

import { AppActions } from './app.actions';
import { OUTBOX_MESSAGES } from './outbox-messages';
import { OutboxActions } from './outbox.actions';
import { OutboxEffects } from './outbox.effects';
import { OutboxState } from './outbox.model';
import { outboxInitialState, outboxReducer } from './outbox.reducers';
import { oldestFailedSelector } from './outbox.selectors';
import { FAILURE_MESSAGES } from './report-failure';

function makeRecord(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
  return {
    localId: 'r-1',
    kind: 'addExpense',
    spreadsheetId: 'spsh-1',
    payload: {
      sheetId: 3,
      expense: { date: new Date(2024, 0, 1), amount: 10, category: 'Food', comment: '', isInDebt: false }
    },
    enqueuedAt: 1000,
    status: 'pending',
    attempts: 0,
    ...overrides
  };
}

/** Minimal, fully-controllable `OutboxStorage` double for edge-case / error-path tests where
 * `InMemoryOutboxStorage`'s real behaviour would be too helpful to exercise the failure paths. */
class ControllableOutboxStorage implements OutboxStorage {
  isAvailable = vi.fn().mockReturnValue(true);
  getAll = vi.fn().mockReturnValue(of<Array<OutboxRecord>>([]));
  add = vi.fn().mockReturnValue(of(undefined));
  updateStatus = vi.fn().mockReturnValue(of(undefined));
  remove = vi.fn().mockReturnValue(of(undefined));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls instead of relying on a fixed number of microtask flushes, since a drain pass chains an
 * unpredictable number of `await firstValueFrom(...)` turns depending on how many items it sends. */
async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor: timed out. Last dispatch types were unavailable.`);
    }
    await wait(5);
  }
}

interface Harness {
  actions$: Subject<Action>;
  dispatch: (action: Action) => void;
  dispatchedActions: Array<Action>;
  storage: OutboxStorage;
  lockRun: ReturnType<typeof vi.fn>;
  online$: BehaviorSubject<boolean>;
  user$: BehaviorSubject<{ name: string } | undefined>;
  getSpreadsheetId: ReturnType<typeof vi.fn>;
  addExpense: ReturnType<typeof vi.fn>;
  router: { events: Subject<unknown>; url: string };
  snackBarOpen: ReturnType<typeof vi.fn>;
  openFromComponent: ReturnType<typeof vi.fn>;
  announce: ReturnType<typeof vi.fn>;
  setChoice: (choice: 'retry' | 'discard' | 'close' | null) => void;
  effects: OutboxEffects;
}

function setup(options: { storage?: OutboxStorage; spreadsheetId?: string } = {}): Harness {
  const actions$ = new Subject<Action>();
  const state$ = new BehaviorSubject<OutboxState>(outboxInitialState);
  const dispatchedActions: Array<Action> = [];
  // A real reducer-backed fake store: `dispatch` actually folds the action into `outboxReducer`
  // state, so `select(oldestFailedSelector)` reflects reality without hand-tracking arrays. This
  // is safe for every action type the effect dispatches (`AppActions.*` fall through the
  // `createReducer` default branch unchanged). `dispatch` also re-emits onto `actions$`: in the
  // real app `Store.dispatch` and `Actions` observe the same underlying stream, and this effects
  // class dispatches actions to itself (`drainCompleted` -> `reloadOnDrainCompleted$` /
  // `failureNoticeOnDrainCompleted$` / `announceAllSent$`; `enqueue`'s `drainRequested` and
  // `openFailureNotice`'s `retry`/`discard` -> `drainOnTrigger$` / `retry$` / `discard$`) that
  // would otherwise never reach those effects, since `provideMockActions` gives `Actions` a
  // separate, manually-driven stream.
  const dispatch = vi.fn((action: Action) => {
    dispatchedActions.push(action);
    state$.next(outboxReducer(state$.value, action as Parameters<typeof outboxReducer>[1]));
    actions$.next(action);
  });
  const select = vi.fn((selector: unknown) => {
    if (selector === oldestFailedSelector) {
      return state$.pipe(map((state) => oldestFailedSelector({ outbox: state })));
    }
    return of(undefined);
  });
  const storeStub: Pick<Store, 'select' | 'dispatch'> = {
    select: select as unknown as Store['select'],
    dispatch: dispatch as unknown as Store['dispatch']
  };

  const online$ = new BehaviorSubject<boolean>(true);
  const user$ = new BehaviorSubject<{ name: string } | undefined>({ name: 'Oleg' });
  const getSpreadsheetId = vi.fn().mockReturnValue(options.spreadsheetId ?? 'spsh-1');
  const addExpense = vi.fn();
  const router = { events: new Subject<unknown>(), url: '/dashboard' };
  const snackBarOpen = vi.fn();
  let choiceValue: 'retry' | 'discard' | 'close' | null = null;
  const openFromComponent = vi.fn().mockImplementation(() => ({
    instance: { choice: () => choiceValue },
    afterDismissed: () => of(undefined)
  }));
  const announce = vi.fn().mockResolvedValue(undefined);
  const lockRun = vi.fn((work: () => Observable<unknown>) => work());

  const storage = options.storage ?? new InMemoryOutboxStorage();

  TestBed.configureTestingModule({
    providers: [
      OutboxEffects,
      provideMockActions(() => actions$),
      { provide: Store, useValue: storeStub },
      { provide: NetworkStatusService, useValue: { online$ } },
      { provide: AbstractSecurityService, useValue: { user$ } },
      { provide: SpreadsheetService, useValue: { getSpreadsheetId, addExpense } },
      { provide: OutboxStorage, useValue: storage },
      { provide: OutboxDrainLock, useValue: { run: lockRun } },
      { provide: Router, useValue: router },
      { provide: MatSnackBar, useValue: { open: snackBarOpen, openFromComponent } },
      { provide: LiveAnnouncer, useValue: { announce } }
    ]
  });

  const effects = TestBed.inject(OutboxEffects);

  return {
    actions$,
    dispatch,
    dispatchedActions,
    storage,
    lockRun,
    online$,
    user$,
    getSpreadsheetId,
    addExpense,
    router,
    snackBarOpen,
    openFromComponent,
    announce,
    setChoice: (c) => (choiceValue = c),
    effects
  };
}

/** Subscribes to every `createEffect` field, mirroring what `EffectsModule` does at runtime.
 * `reloadOnDrainCompleted$` is the only field without `{ dispatch: false }`, so its emissions are
 * forwarded into the fake store's `dispatch` by hand. */
function activate(h: Harness): void {
  h.effects.hydrateOnInit$.subscribe();
  h.effects.persistEnqueue$.subscribe();
  h.effects.drainOnTrigger$.subscribe();
  h.effects.retry$.subscribe();
  h.effects.discard$.subscribe();
  h.effects.failureNoticeOnDrainCompleted$.subscribe();
  h.effects.failureNoticeOnSyncRequested$.subscribe();
  h.effects.reloadOnDrainCompleted$.subscribe((action) => h.dispatch(action));
  h.effects.announceAllSent$.subscribe();
}

function drainCompletedCount(h: Harness): number {
  return h.dispatchedActions.filter((a) => a.type === OutboxActions.drainCompleted.type).length;
}

function hydrate(h: Harness): Promise<void> {
  h.actions$.next({ type: ROOT_EFFECTS_INIT });
  return waitFor(() => drainCompletedCount(h) >= 1);
}

let originalLog: unknown;

beforeEach(() => {
  originalLog = (globalThis as unknown as { log?: unknown }).log;
});

afterEach(() => {
  (globalThis as unknown as { log: unknown }).log = originalLog;
});

// [AC28] proves [AC20]-[AC27] with provideMockActions, InMemoryOutboxStorage / a controllable
// double, a pass-through OutboxDrainLock stub, and the listed service stubs. Assertions are on
// call order and count, never marbles.
describe('[AC28] OutboxEffects', () => {
  describe('[AC20] hydration', () => {
    it('should_call_getAll_once_and_dispatch_hydrated_on_ROOT_EFFECTS_INIT', async () => {
      const storage = new InMemoryOutboxStorage();
      const record = makeRecord({ localId: 'seed' });
      await new Promise<void>((resolve) => storage.add(record).subscribe(() => resolve()));
      const getAllSpy = vi.spyOn(storage, 'getAll');

      const h = setup({ storage });
      activate(h);

      h.actions$.next({ type: ROOT_EFFECTS_INIT });
      await waitFor(() => h.dispatchedActions.some((a) => a.type === OutboxActions.hydrated.type));

      expect(getAllSpy).toHaveBeenCalledTimes(1);
      const hydratedAction = h.dispatchedActions.find(
        (a) => a.type === OutboxActions.hydrated.type
      ) as ReturnType<typeof OutboxActions.hydrated>;
      expect(hydratedAction.records.map((r) => r.localId)).toEqual(['seed']);
    });

    it('should_not_touch_storage_when_isAvailable_is_false_and_no_pass_ever_runs', async () => {
      const storage = new ControllableOutboxStorage();
      storage.isAvailable.mockReturnValue(false);
      const h = setup({ storage });
      activate(h);

      h.actions$.next({ type: ROOT_EFFECTS_INIT });
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.dispatchedActions.some((a) => a.type === OutboxActions.hydrated.type)).toBe(false);

      // Since hydration never completed, P1 never holds -- a later trigger must still no-op.
      h.actions$.next(OutboxActions.drainRequested());
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.lockRun).not.toHaveBeenCalled();
    });

    it('should_log_dispatch_nothing_and_never_run_a_pass_when_getAll_errors_at_hydration', async () => {
      const storage = new ControllableOutboxStorage();
      storage.getAll.mockReturnValue(throwError(() => new Error('boom')));
      const h = setup({ storage });
      activate(h);
      const logSpy = vi.fn();
      (globalThis as unknown as { log: unknown }).log = logSpy;

      h.actions$.next({ type: ROOT_EFFECTS_INIT });
      await wait(50);

      expect(logSpy).toHaveBeenCalled();
      expect(h.dispatchedActions).toHaveLength(0);

      // hydrationDone never became true; a later trigger must still find P1 unmet.
      const callsBefore = storage.getAll.mock.calls.length;
      h.actions$.next(OutboxActions.drainRequested());
      await wait(50);

      expect(storage.getAll.mock.calls.length).toBe(callsBefore);
      expect(h.lockRun).not.toHaveBeenCalled();
    });
  });

  describe('[AC21] persist-first enqueue', () => {
    it('should_dispatch_enqueued_then_drainRequested_then_announce_queued_when_add_succeeds_and_drain_is_true', async () => {
      const h = setup();
      activate(h);
      const record = makeRecord();

      h.actions$.next(OutboxActions.enqueue({ record, drain: true }));
      await waitFor(() => h.dispatchedActions.some((a) => a.type === OutboxActions.drainRequested.type));

      const types = h.dispatchedActions.map((a) => a.type);
      const enqueuedIndex = types.indexOf(OutboxActions.enqueued.type);
      const drainRequestedIndex = types.indexOf(OutboxActions.drainRequested.type);
      expect(enqueuedIndex).toBeGreaterThanOrEqual(0);
      expect(drainRequestedIndex).toBeGreaterThan(enqueuedIndex);
      expect(h.announce).toHaveBeenCalledWith(OUTBOX_MESSAGES.queued, 'polite');
    });

    it('should_not_dispatch_drainRequested_when_drain_is_false', async () => {
      const h = setup();
      activate(h);
      const record = makeRecord();

      h.actions$.next(OutboxActions.enqueue({ record, drain: false }));
      await waitFor(() => h.dispatchedActions.some((a) => a.type === OutboxActions.enqueued.type));
      await wait(30);

      expect(h.dispatchedActions.some((a) => a.type === OutboxActions.drainRequested.type)).toBe(false);
    });

    it('should_dispatch_loading_false_and_operationFailed_and_no_enqueued_when_the_add_fails', async () => {
      const storage = new ControllableOutboxStorage();
      storage.add.mockReturnValue(throwError(() => new Error('disk full')));
      const h = setup({ storage });
      activate(h);
      const record = makeRecord();

      h.actions$.next(OutboxActions.enqueue({ record, drain: true }));
      await waitFor(() => h.dispatchedActions.some((a) => a.type === AppActions.operationFailed.type));

      expect(h.dispatchedActions).toContainEqual(AppActions.loading({ loading: false }));
      expect(h.dispatchedActions).toContainEqual(
        AppActions.operationFailed({ source: 'addExpense$', message: FAILURE_MESSAGES.addExpense$ })
      );
      expect(h.dispatchedActions.some((a) => a.type === OutboxActions.enqueued.type)).toBe(false);
    });

    it('should_process_two_enqueue_actions_in_arrival_order_concatMap', async () => {
      const h = setup();
      activate(h);
      const a = makeRecord({ localId: 'a', enqueuedAt: 1 });
      const b = makeRecord({ localId: 'b', enqueuedAt: 2 });

      h.actions$.next(OutboxActions.enqueue({ record: a, drain: false }));
      h.actions$.next(OutboxActions.enqueue({ record: b, drain: false }));
      await waitFor(
        () => h.dispatchedActions.filter((act) => act.type === OutboxActions.enqueued.type).length === 2
      );

      const enqueuedOrder = h.dispatchedActions
        .filter((act) => act.type === OutboxActions.enqueued.type)
        .map((act) => (act as ReturnType<typeof OutboxActions.enqueued>).record.localId);
      expect(enqueuedOrder).toEqual(['a', 'b']);
    });
  });

  describe('[AC22] triggers and coalescing (T1-T5, no hot loop)', () => {
    it('should_start_exactly_one_pass_on_T1_hydration', async () => {
      const h = setup();
      activate(h);

      await hydrate(h);

      expect(drainCompletedCount(h)).toBe(1);
    });

    it('should_start_a_pass_on_T2_only_on_the_false_to_true_edge_not_on_the_initial_value_or_a_true_to_false_transition', async () => {
      const h = setup();
      activate(h);
      await hydrate(h);
      const baseline = drainCompletedCount(h);

      h.online$.next(false); // true -> false: not a rising edge
      await wait(50);
      expect(drainCompletedCount(h)).toBe(baseline);

      h.online$.next(true); // false -> true: rising edge, T2
      await waitFor(() => drainCompletedCount(h) === baseline + 1);
    });

    it('should_start_a_pass_on_T3_NavigationEnd', async () => {
      const h = setup();
      activate(h);
      await hydrate(h);
      const baseline = drainCompletedCount(h);

      h.router.events.next(new NavigationEnd(1, '/dashboard', '/dashboard'));

      await waitFor(() => drainCompletedCount(h) === baseline + 1);
    });

    it('should_start_a_pass_on_T4_drainRequested', async () => {
      const h = setup();
      activate(h);
      await hydrate(h);
      const baseline = drainCompletedCount(h);

      h.actions$.next(OutboxActions.drainRequested());

      await waitFor(() => drainCompletedCount(h) === baseline + 1);
    });

    it('should_start_a_pass_on_T5_syncRequested', async () => {
      const h = setup();
      activate(h);
      await hydrate(h);
      const baseline = drainCompletedCount(h);

      h.actions$.next(OutboxActions.syncRequested());

      await waitFor(() => drainCompletedCount(h) === baseline + 1);
    });

    it('should_coalesce_two_or_more_triggers_that_arrive_during_a_running_pass_into_exactly_one_extra_pass', async () => {
      const storage = new InMemoryOutboxStorage();
      const record = makeRecord({ localId: 'gated', spreadsheetId: 'spsh-1' });
      await new Promise<void>((resolve) => storage.add(record).subscribe(() => resolve()));
      const h = setup({ storage });
      const sendGate = new Subject<unknown>();
      h.addExpense.mockReturnValue(sendGate);
      activate(h);

      // T1 starts pass #1, which blocks mid-send on `sendGate`.
      h.actions$.next({ type: ROOT_EFFECTS_INIT });
      await waitFor(() => h.addExpense.mock.calls.length === 1);

      // Two more triggers arrive while pass #1 is still running.
      h.actions$.next(OutboxActions.drainRequested());
      h.actions$.next(OutboxActions.syncRequested());
      await wait(30);
      expect(drainCompletedCount(h)).toBe(0); // pass #1 hasn't finished yet

      sendGate.next({});
      await waitFor(() => drainCompletedCount(h) === 2, 3000); // pass #1, then exactly one coalesced extra pass

      expect(h.addExpense).toHaveBeenCalledTimes(1); // the coalesced pass found nothing left to send
      await wait(100);
      expect(drainCompletedCount(h)).toBe(2); // no further pass ran
    });

    it('should_make_exactly_one_addExpense_call_when_a_single_retryable_failure_has_no_further_triggers', async () => {
      const storage = new InMemoryOutboxStorage();
      const record = makeRecord({ localId: 'flaky', spreadsheetId: 'spsh-1' });
      await new Promise<void>((resolve) => storage.add(record).subscribe(() => resolve()));
      const h = setup({ storage });
      h.addExpense.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      activate(h);

      await hydrate(h);
      await wait(100); // give any (incorrect) extra pass a chance to happen

      expect(h.addExpense).toHaveBeenCalledTimes(1);
      expect(drainCompletedCount(h)).toBe(1);
    });
  });

  describe('[AC23] preconditions P1-P4', () => {
    it('should_make_zero_storage_lock_send_and_dispatch_calls_when_P1_hydration_has_not_completed', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });
      activate(h);

      h.actions$.next(OutboxActions.drainRequested());
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.lockRun).not.toHaveBeenCalled();
      expect(h.addExpense).not.toHaveBeenCalled();
      expect(h.dispatchedActions).toHaveLength(0);
    });

    it('should_make_zero_storage_lock_send_and_dispatch_calls_when_P2_online_is_false', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });
      activate(h);
      await hydrate(h);

      h.online$.next(false); // true->false, not a trigger by itself
      storage.getAll.mockClear();
      h.lockRun.mockClear();
      h.dispatchedActions.length = 0;

      h.actions$.next(OutboxActions.drainRequested());
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.lockRun).not.toHaveBeenCalled();
      expect(h.addExpense).not.toHaveBeenCalled();
      expect(h.dispatchedActions).toHaveLength(0);
    });

    it('should_make_zero_storage_lock_send_and_dispatch_calls_when_P3_user_is_undefined', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });
      activate(h);
      await hydrate(h);

      h.user$.next(undefined);
      storage.getAll.mockClear();
      h.lockRun.mockClear();
      h.dispatchedActions.length = 0;

      h.actions$.next(OutboxActions.drainRequested());
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.lockRun).not.toHaveBeenCalled();
      expect(h.dispatchedActions).toHaveLength(0);
    });

    it('should_make_zero_storage_lock_send_and_dispatch_calls_when_P4_spreadsheet_id_is_empty', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });
      activate(h);
      await hydrate(h);

      h.getSpreadsheetId.mockReturnValue('');
      storage.getAll.mockClear();
      h.lockRun.mockClear();
      h.dispatchedActions.length = 0;

      h.actions$.next(OutboxActions.drainRequested());
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.lockRun).not.toHaveBeenCalled();
      expect(h.dispatchedActions).toHaveLength(0);
    });

    it('should_start_a_pass_that_sends_via_NavigationEnd_once_P3_and_P4_become_true', async () => {
      const storage = new ControllableOutboxStorage();
      // Not yet signed in, so hydration's own T1 pass attempt aborts at P3.
      const h = setup({ storage, spreadsheetId: '' });
      h.user$.next(undefined);
      h.getSpreadsheetId.mockReturnValue('');
      activate(h);

      h.actions$.next({ type: ROOT_EFFECTS_INIT }); // hydrationDone becomes true; the T1 pass aborts at P3
      await waitFor(() => storage.getAll.mock.calls.length >= 1);
      const record = makeRecord({ localId: 'ready', spreadsheetId: 'spsh-1' });
      // `ControllableOutboxStorage` is a static stub, not a real store: after the record is sent
      // it must stop being returned, or the sessionSent guard would loop forever re-attempting
      // (and failing) its removal. Two reads see the record (the pass's initial snapshot, then
      // the loop's first fresh read that actually picks and sends it); every read after that
      // reflects it having been removed.
      storage.getAll.mockReturnValueOnce(of([record])).mockReturnValueOnce(of([record])).mockReturnValue(of([]));
      h.addExpense.mockReturnValue(of({}));

      h.user$.next({ name: 'Oleg' });
      h.getSpreadsheetId.mockReturnValue('spsh-1');
      h.router.events.next(new NavigationEnd(1, '/dashboard', '/dashboard'));

      await waitFor(() => h.addExpense.mock.calls.length === 1);
      expect(h.addExpense).toHaveBeenCalledWith(record.payload.sheetId, record.payload.expense);
    });
  });

  describe('[AC24] pass algorithm', () => {
    it('should_dispatch_hydrated_at_the_start_and_again_before_drainCompleted', async () => {
      const h = setup();
      activate(h);

      await hydrate(h);

      const hydratedCount = h.dispatchedActions.filter((a) => a.type === OutboxActions.hydrated.type).length;
      expect(hydratedCount).toBeGreaterThanOrEqual(2);
      const lastHydratedIndex = h.dispatchedActions.map((a) => a.type).lastIndexOf(OutboxActions.hydrated.type);
      const drainCompletedIndex = h.dispatchedActions.map((a) => a.type).indexOf(OutboxActions.drainCompleted.type);
      expect(lastHydratedIndex).toBeLessThan(drainCompletedIndex);
    });

    it('should_run_the_whole_pass_inside_OutboxDrainLock_run', async () => {
      const h = setup();
      activate(h);

      await hydrate(h);

      expect(h.lockRun).toHaveBeenCalledTimes(1);
    });

    it('should_send_strictly_FIFO_one_in_flight_at_a_time_by_enqueuedAt_then_localId', async () => {
      const storage = new InMemoryOutboxStorage();
      const a = makeRecord({ localId: 'a', enqueuedAt: 1000, spreadsheetId: 'spsh-1' });
      const b = makeRecord({ localId: 'b', enqueuedAt: 2000, spreadsheetId: 'spsh-1' });
      await new Promise<void>((resolve) => storage.add(b).subscribe(() => storage.add(a).subscribe(() => resolve())));
      const h = setup({ storage });
      const gates: Array<Subject<unknown>> = [new Subject(), new Subject()];
      let call = 0;
      h.addExpense.mockImplementation(() => gates[call++]);
      activate(h);

      h.actions$.next({ type: ROOT_EFFECTS_INIT });
      await waitFor(() => h.addExpense.mock.calls.length === 1);
      expect(h.addExpense).toHaveBeenNthCalledWith(1, a.payload.sheetId, a.payload.expense); // 'a' (1000) before 'b' (2000)

      await wait(50);
      expect(h.addExpense).toHaveBeenCalledTimes(1); // second call must wait for the first to emit

      gates[0].next({});
      await waitFor(() => h.addExpense.mock.calls.length === 2);
      expect(h.addExpense).toHaveBeenNthCalledWith(2, b.payload.sheetId, b.payload.expense);

      gates[1].next({});
      await waitFor(() => drainCompletedCount(h) === 1);
      const completed = h.dispatchedActions.find(
        (act) => act.type === OutboxActions.drainCompleted.type
      ) as ReturnType<typeof OutboxActions.drainCompleted>;
      expect(completed.sent).toBe(2);
      expect(completed.remainingPending).toBe(0);
    });

    it('should_read_fresh_before_every_item_so_a_record_removed_between_iterations_is_skipped', async () => {
      const storage = new ControllableOutboxStorage();
      const a = makeRecord({ localId: 'a', enqueuedAt: 1000, spreadsheetId: 'spsh-1' });
      const b = makeRecord({ localId: 'b', enqueuedAt: 2000, spreadsheetId: 'spsh-1' });
      storage.getAll
        .mockReturnValueOnce(of([a, b])) // hydrateOnInit$'s own read, on ROOT_EFFECTS_INIT
        .mockReturnValueOnce(of([a, b])) // pass initial snapshot
        .mockReturnValueOnce(of([a, b])) // loop fresh read #1 -> picks a
        .mockReturnValueOnce(of([])) // loop fresh read #2 -> b was removed by "another tab"
        .mockReturnValue(of([])); // final read
      const h = setup({ storage });
      h.addExpense.mockReturnValue(of({}));
      activate(h);

      await hydrate(h);

      expect(h.addExpense).toHaveBeenCalledTimes(1);
      expect(h.addExpense).toHaveBeenCalledWith(a.payload.sheetId, a.payload.expense);
    });

    it('should_not_send_and_should_continue_the_pass_on_a_spreadsheet_mismatch', async () => {
      const storage = new InMemoryOutboxStorage();
      const mismatched = makeRecord({ localId: 'mismatch', enqueuedAt: 1000, spreadsheetId: 'other-sheet' });
      const matching = makeRecord({ localId: 'match', enqueuedAt: 2000, spreadsheetId: 'spsh-1' });
      await new Promise<void>((resolve) =>
        storage.add(mismatched).subscribe(() => storage.add(matching).subscribe(() => resolve()))
      );
      const h = setup({ storage });
      h.addExpense.mockReturnValue(of({}));
      activate(h);

      await hydrate(h);

      expect(h.addExpense).toHaveBeenCalledTimes(1);
      expect(h.addExpense).toHaveBeenCalledWith(matching.payload.sheetId, matching.payload.expense);
      const terminallyFailed = h.dispatchedActions.find(
        (a) => a.type === OutboxActions.terminallyFailed.type
      ) as ReturnType<typeof OutboxActions.terminallyFailed>;
      expect(terminallyFailed.localId).toBe('mismatch');
      expect(terminallyFailed.failure).toBe('otherSpreadsheet');
      const completed = h.dispatchedActions.find(
        (a) => a.type === OutboxActions.drainCompleted.type
      ) as ReturnType<typeof OutboxActions.drainCompleted>;
      expect(completed.sent).toBe(1);
      expect(completed.newlyFailed).toBe(1);
    });

    it('should_never_resend_a_localId_already_sent_this_session_even_if_remove_keeps_failing', async () => {
      const storage = new ControllableOutboxStorage();
      const record = makeRecord({ localId: 'stuck', spreadsheetId: 'spsh-1' });
      storage.getAll.mockReturnValue(of([record])); // remove never actually clears it from this stub
      storage.remove.mockReturnValue(throwError(() => new Error('remove failed')));
      const h = setup({ storage });
      h.addExpense.mockReturnValue(of({}));
      activate(h);

      await hydrate(h);

      expect(h.addExpense).toHaveBeenCalledTimes(1); // sent once
      const completed = h.dispatchedActions.find(
        (a) => a.type === OutboxActions.drainCompleted.type
      ) as ReturnType<typeof OutboxActions.drainCompleted>;
      expect(completed.sent).toBe(1); // counted once, not once per loop iteration
    });

    it('should_stop_the_pass_before_the_next_send_when_going_offline_mid_pass', async () => {
      const storage = new InMemoryOutboxStorage();
      const a = makeRecord({ localId: 'a', enqueuedAt: 1000, spreadsheetId: 'spsh-1' });
      const b = makeRecord({ localId: 'b', enqueuedAt: 2000, spreadsheetId: 'spsh-1' });
      await new Promise<void>((resolve) => storage.add(a).subscribe(() => storage.add(b).subscribe(() => resolve())));
      const h = setup({ storage });
      const gate = new Subject<unknown>();
      h.addExpense.mockReturnValueOnce(gate).mockReturnValue(of({}));
      activate(h);

      h.actions$.next({ type: ROOT_EFFECTS_INIT });
      await waitFor(() => h.addExpense.mock.calls.length === 1);

      h.online$.next(false); // go offline while 'a' is in flight
      gate.next({}); // 'a' succeeds; the online check before the *next* item should now fail

      await waitFor(() => drainCompletedCount(h) === 1);
      expect(h.addExpense).toHaveBeenCalledTimes(1); // 'b' was never attempted
    });
  });

  describe('[AC25] auth toast, once per episode', () => {
    it('should_dispatch_operationFailed_outboxDrain_on_the_first_auth_stop_not_on_a_second_consecutive_one_and_again_after_a_success', async () => {
      // A real InMemoryOutboxStorage is used (rather than a static stub) because pass 3's success
      // must actually remove the record -- a stub that keeps returning it forever would make the
      // sessionSent guard loop without ever breaking (only a `remove` *error* breaks that branch).
      const storage = new InMemoryOutboxStorage();
      const record = makeRecord({ localId: 'auth-record-1', spreadsheetId: 'spsh-1' });
      await new Promise<void>((resolve) => storage.add(record).subscribe(() => resolve()));
      const h = setup({ storage });
      activate(h);

      const authError = () => throwError(() => new HttpErrorResponse({ status: 401 }));
      const authToastCount = () =>
        h.dispatchedActions.filter(
          (a) =>
            a.type === AppActions.operationFailed.type &&
            (a as ReturnType<typeof AppActions.operationFailed>).source === 'outboxDrain$'
        ).length;

      // Pass 1: auth failure -> toast (episode start). The record stays pending (attempts+1), so
      // it is still the oldest pending record for pass 2.
      h.addExpense.mockReturnValueOnce(authError());
      h.actions$.next({ type: ROOT_EFFECTS_INIT });
      await waitFor(() => drainCompletedCount(h) === 1);
      expect(authToastCount()).toBe(1);

      // Pass 2: another consecutive auth failure on the same still-pending record -> no toast.
      h.addExpense.mockReturnValueOnce(authError());
      h.actions$.next(OutboxActions.syncRequested());
      await waitFor(() => drainCompletedCount(h) === 2);
      expect(authToastCount()).toBe(1);

      // Pass 3: a success removes the record and resets the episode.
      h.addExpense.mockReturnValueOnce(of({}));
      h.actions$.next(OutboxActions.syncRequested());
      await waitFor(() => drainCompletedCount(h) === 3);
      expect(authToastCount()).toBe(1);

      // Pass 4: a fresh record fails auth again -> toast fires again, a new episode.
      const secondRecord = makeRecord({ localId: 'auth-record-2', spreadsheetId: 'spsh-1', enqueuedAt: 2000 });
      await new Promise<void>((resolve) => storage.add(secondRecord).subscribe(() => resolve()));
      h.addExpense.mockReturnValueOnce(authError());
      h.actions$.next(OutboxActions.syncRequested());
      await waitFor(() => drainCompletedCount(h) === 4);
      expect(authToastCount()).toBe(2);
    });

    it('should_expose_the_verbatim_D12_D13_copy_strings', () => {
      expect(OUTBOX_MESSAGES.queued).toBe(
        'Expense saved on this device. It will be sent to your spreadsheet automatically.'
      );
      expect(OUTBOX_MESSAGES.allSent).toBe('All saved expenses were sent to your spreadsheet.');
      expect(OUTBOX_MESSAGES.authBlocked).toBe(
        "Your saved expenses couldn't be sent because your Google sign-in needs renewing. They're kept on this device."
      );
    });
  });

  describe('[AC26] success reload, /dashboard only', () => {
    it('should_dispatch_exactly_one_loadExpenses_for_lastSent_when_sent_gt_0_and_on_dashboard', async () => {
      const storage = new InMemoryOutboxStorage();
      const record = makeRecord({ localId: 'reload-me', spreadsheetId: 'spsh-1' });
      await new Promise<void>((resolve) => storage.add(record).subscribe(() => resolve()));
      const h = setup({ storage });
      h.router.url = '/dashboard';
      h.addExpense.mockReturnValue(of({}));
      activate(h);

      await hydrate(h);

      const loadExpensesActions = h.dispatchedActions.filter((a) => a.type === AppActions.loadExpenses.type);
      expect(loadExpensesActions).toHaveLength(1);
      const action = loadExpensesActions[0] as ReturnType<typeof AppActions.loadExpenses>;
      expect(action.sheetId).toBe(record.payload.sheetId);
      expect(action.from).toEqual(record.payload.expense.date);
      const expectedTo = new Date(record.payload.expense.date!);
      expectedTo.setDate(expectedTo.getDate() + 1);
      expect(action.to).toEqual(expectedTo);
    });

    it('should_not_dispatch_loadExpenses_when_the_router_is_on_a_dashboard_sub_route', async () => {
      const storage = new InMemoryOutboxStorage();
      const record = makeRecord({ localId: 'stats-page', spreadsheetId: 'spsh-1' });
      await new Promise<void>((resolve) => storage.add(record).subscribe(() => resolve()));
      const h = setup({ storage });
      h.router.url = '/dashboard/statistics';
      h.addExpense.mockReturnValue(of({}));
      activate(h);

      await hydrate(h);

      expect(h.dispatchedActions.some((a) => a.type === AppActions.loadExpenses.type)).toBe(false);
    });

    it('should_not_dispatch_loadExpenses_when_sent_is_zero', async () => {
      const h = setup(); // empty queue: sent stays 0
      h.router.url = '/dashboard';
      activate(h);

      await hydrate(h);

      expect(h.dispatchedActions.some((a) => a.type === AppActions.loadExpenses.type)).toBe(false);
    });

    it('should_announce_allSent_only_when_sent_gt_0_and_remainingPending_is_0', async () => {
      const h = setup();
      activate(h);

      h.actions$.next(OutboxActions.drainCompleted({ sent: 1, newlyFailed: 0, remainingPending: 0, lastSent: null }));
      await wait(30);
      expect(h.announce).toHaveBeenCalledWith(OUTBOX_MESSAGES.allSent, 'polite');

      h.announce.mockClear();
      h.actions$.next(OutboxActions.drainCompleted({ sent: 1, newlyFailed: 0, remainingPending: 2, lastSent: null }));
      await wait(30);
      expect(h.announce).not.toHaveBeenCalledWith(OUTBOX_MESSAGES.allSent, expect.anything());

      h.actions$.next(OutboxActions.drainCompleted({ sent: 0, newlyFailed: 0, remainingPending: 0, lastSent: null }));
      await wait(30);
      expect(h.announce).not.toHaveBeenCalledWith(OUTBOX_MESSAGES.allSent, expect.anything());
    });
  });

  describe('[AC27] failure notice, Retry/Discard/Close', () => {
    it('should_open_the_notice_with_the_oldest_failed_record_and_no_duration_on_drainCompleted_with_newlyFailed', async () => {
      const h = setup();
      activate(h);
      const failedRecord = makeRecord({ localId: 'F1', status: 'failed', failure: 'rejected', enqueuedAt: 1 });
      h.dispatch(OutboxActions.enqueued({ record: failedRecord }));

      h.actions$.next(
        OutboxActions.drainCompleted({ sent: 0, newlyFailed: 1, remainingPending: 0, lastSent: null })
      );
      await waitFor(() => h.openFromComponent.mock.calls.length === 1);

      const [component, config] = h.openFromComponent.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(component).toBeDefined();
      expect((config['data'] as { record: OutboxRecord }).record.localId).toBe('F1');
      expect(config['politeness']).toBe('assertive');
      expect(config['verticalPosition']).toBe('top');
      expect(config).not.toHaveProperty('duration');
    });

    it('should_open_the_notice_on_syncRequested_while_a_failed_record_exists_and_also_start_a_pass', async () => {
      const h = setup();
      activate(h);
      await hydrate(h); // establish P1 so the pass this syncRequested also triggers can run
      h.openFromComponent.mockClear();
      const passesBefore = drainCompletedCount(h);
      const failedRecord = makeRecord({ localId: 'F2', status: 'failed', failure: 'rejected', enqueuedAt: 1 });
      h.dispatch(OutboxActions.enqueued({ record: failedRecord }));

      h.actions$.next(OutboxActions.syncRequested());
      await waitFor(() => h.openFromComponent.mock.calls.length === 1);
      await waitFor(() => drainCompletedCount(h) === passesBefore + 1);

      const [, config] = h.openFromComponent.mock.calls[0] as [unknown, Record<string, unknown>];
      expect((config['data'] as { record: OutboxRecord }).record.localId).toBe('F2');
    });

    it('should_not_open_the_notice_on_syncRequested_when_no_failed_record_exists', async () => {
      const h = setup();
      activate(h);

      h.actions$.next(OutboxActions.syncRequested());
      await wait(50);

      expect(h.openFromComponent).not.toHaveBeenCalled();
    });

    it('should_map_retry_to_updateStatus_pending_then_hydrated_then_drainRequested', async () => {
      const storage = new InMemoryOutboxStorage();
      const failedRecord = makeRecord({ localId: 'F3', status: 'failed', failure: 'rejected', enqueuedAt: 1 });
      await new Promise<void>((resolve) => storage.add(failedRecord).subscribe(() => resolve()));
      const h = setup({ storage });
      activate(h);
      h.dispatch(OutboxActions.enqueued({ record: failedRecord }));
      h.setChoice('retry');

      h.actions$.next(
        OutboxActions.drainCompleted({ sent: 0, newlyFailed: 1, remainingPending: 0, lastSent: null })
      );
      await waitFor(() => h.dispatchedActions.some((a) => a.type === OutboxActions.retry.type));
      expect(h.dispatchedActions).toContainEqual(OutboxActions.retry({ localId: 'F3' }));

      // `h.dispatch` re-emits onto `actions$` (see the comment on its definition in `setup()`),
      // so `openFailureNotice`'s own `store.dispatch(retry(...))` above already reached `retry$`.
      await waitFor(() => h.dispatchedActions.some((a) => a.type === OutboxActions.drainRequested.type));

      const updated = await new Promise<Array<OutboxRecord>>((resolve) =>
        storage.getAll().subscribe((records) => resolve(records))
      );
      expect(updated.find((r) => r.localId === 'F3')).toMatchObject({ status: 'pending', failure: undefined });

      const types = h.dispatchedActions.map((a) => a.type);
      const retryIndex = types.lastIndexOf(OutboxActions.retry.type);
      const hydratedIndexAfterRetry = types.indexOf(OutboxActions.hydrated.type, retryIndex);
      const drainRequestedIndexAfterRetry = types.indexOf(OutboxActions.drainRequested.type, retryIndex);
      expect(hydratedIndexAfterRetry).toBeGreaterThan(retryIndex);
      expect(drainRequestedIndexAfterRetry).toBeGreaterThan(hydratedIndexAfterRetry);
    });

    it('should_map_discard_to_remove_then_hydrated_with_no_drainRequested', async () => {
      const storage = new InMemoryOutboxStorage();
      const failedRecord = makeRecord({ localId: 'F4', status: 'failed', failure: 'rejected', enqueuedAt: 1 });
      await new Promise<void>((resolve) => storage.add(failedRecord).subscribe(() => resolve()));
      const h = setup({ storage });
      activate(h);
      h.dispatch(OutboxActions.enqueued({ record: failedRecord }));
      h.setChoice('discard');

      h.actions$.next(
        OutboxActions.drainCompleted({ sent: 0, newlyFailed: 1, remainingPending: 0, lastSent: null })
      );
      await waitFor(() => h.dispatchedActions.some((a) => a.type === OutboxActions.discard.type));
      expect(h.dispatchedActions).toContainEqual(OutboxActions.discard({ localId: 'F4' }));

      // `h.dispatch` re-emits onto `actions$`, so `discard$` (listening on `Actions`) has already
      // reacted to `openFailureNotice`'s own `store.dispatch(discard(...))` above.
      await waitFor(() => {
        const idx = h.dispatchedActions.map((a) => a.type).lastIndexOf(OutboxActions.discard.type);
        return h.dispatchedActions.map((a) => a.type).indexOf(OutboxActions.hydrated.type, idx) >= 0;
      });

      const remaining = await new Promise<Array<OutboxRecord>>((resolve) =>
        storage.getAll().subscribe((records) => resolve(records))
      );
      expect(remaining.find((r) => r.localId === 'F4')).toBeUndefined();
      expect(h.dispatchedActions.some((a) => a.type === OutboxActions.drainRequested.type)).toBe(false);
    });

    it('should_dispatch_nothing_when_the_choice_is_close', async () => {
      const h = setup();
      activate(h);
      const failedRecord = makeRecord({ localId: 'F5', status: 'failed', failure: 'rejected', enqueuedAt: 1 });
      h.dispatch(OutboxActions.enqueued({ record: failedRecord }));
      h.setChoice('close');

      h.actions$.next(
        OutboxActions.drainCompleted({ sent: 0, newlyFailed: 1, remainingPending: 0, lastSent: null })
      );
      await waitFor(() => h.openFromComponent.mock.calls.length === 1);
      await wait(50);

      expect(h.dispatchedActions.some((a) => a.type === OutboxActions.retry.type)).toBe(false);
      expect(h.dispatchedActions.some((a) => a.type === OutboxActions.discard.type)).toBe(false);
    });

    it('should_dispatch_nothing_when_there_is_no_choice_at_all', async () => {
      const h = setup();
      activate(h);
      const failedRecord = makeRecord({ localId: 'F6', status: 'failed', failure: 'rejected', enqueuedAt: 1 });
      h.dispatch(OutboxActions.enqueued({ record: failedRecord }));
      h.setChoice(null);

      h.actions$.next(
        OutboxActions.drainCompleted({ sent: 0, newlyFailed: 1, remainingPending: 0, lastSent: null })
      );
      await waitFor(() => h.openFromComponent.mock.calls.length === 1);
      await wait(50);

      expect(h.dispatchedActions.some((a) => a.type === OutboxActions.retry.type)).toBe(false);
      expect(h.dispatchedActions.some((a) => a.type === OutboxActions.discard.type)).toBe(false);
    });
  });
});

// RR-9 item 1 regression (docs/reviews/write-outbox.md "Re-review 1", blocking item 1): the drain
// pass must not wedge `OutboxEffects`'s single-flight state and the Web Lock
// `exp-spsh-outbox-drain` when the *real* `IndexedDbOutboxStorage`'s `db.transaction(...)` throws
// synchronously (e.g. `InvalidStateError` on a browser-force-closed connection). This deliberately
// does not use `ControllableOutboxStorage`/`throwError(...)` and does not use the `lockRun`
// pass-through stub from `setup()` above: a storage stub that errors via RxJS, or a lock stub that
// just calls `work()` directly, would already pass against the pre-fix code too, because the hang
// lived inside `IndexedDbOutboxStorage.withStore` and the wedge inside the *real*
// `navigator.locks` callback contract, neither of which a stub reproduces. Such a stubbed test
// would be a lock-release regression net at best, not proof of this fix -- so this describe wires
// up the real `IndexedDbOutboxStorage` and the real `OutboxDrainLock` (real Web Locks in headless
// Chromium) instead.
//
// Against the pre-fix `withStore` (`this.open().then(onFulfilled, fail)` with no try/catch around
// `onFulfilled`, and no `db.onclose` handler at all), the second pass's unguarded
// `initial = await firstValueFrom(this.storage.getAll())` (`outbox.effects.ts:303`) would hang
// forever: `OutboxDrainLock.run`'s work-promise never settles, so the promise returned to
// `navigator.locks.request(...)`'s callback never resolves, the Web Lock is never released, and
// `lockAvailable()` below would keep resolving `false` until `waitUntil` throws its own timeout
// error rather than ever observing `true`.
describe('[AC7] OutboxEffects drain pass with the real IndexedDbOutboxStorage and OutboxDrainLock (RR-9 item 1)', () => {
  const DB_NAME = 'exp-spsh-outbox';
  const LOCK_NAME = 'exp-spsh-outbox-drain';

  function deleteRealDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error as unknown);
      request.onblocked = () => resolve();
    });
  }

  function lockAvailable(): Promise<boolean> {
    return navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => lock !== null);
  }

  async function waitUntil(predicate: () => boolean | Promise<boolean>, timeoutMs = 3000): Promise<void> {
    const start = Date.now();
    for (;;) {
      if (await predicate()) {
        return;
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error('waitUntil: timed out');
      }
      await wait(20);
    }
  }

  function setupWithRealStorageAndLock(): { actions$: Subject<Action>; dispatched: Array<Action> } {
    const actions$ = new Subject<Action>();
    const state$ = new BehaviorSubject<OutboxState>(outboxInitialState);
    const dispatched: Array<Action> = [];
    const dispatch = (action: Action): void => {
      dispatched.push(action);
      state$.next(outboxReducer(state$.value, action as Parameters<typeof outboxReducer>[1]));
      actions$.next(action);
    };
    const select = (selector: unknown): Observable<unknown> => {
      if (selector === oldestFailedSelector) {
        return state$.pipe(map((state) => oldestFailedSelector({ outbox: state })));
      }
      return of(undefined);
    };
    const storeStub: Pick<Store, 'select' | 'dispatch'> = {
      select: select as unknown as Store['select'],
      dispatch: dispatch as unknown as Store['dispatch']
    };

    TestBed.configureTestingModule({
      providers: [
        OutboxEffects,
        provideMockActions(() => actions$),
        { provide: Store, useValue: storeStub },
        { provide: NetworkStatusService, useValue: { online$: new BehaviorSubject(true) } },
        { provide: AbstractSecurityService, useValue: { user$: new BehaviorSubject({ name: 'Oleg' }) } },
        {
          provide: SpreadsheetService,
          useValue: { getSpreadsheetId: () => 'spsh-1', addExpense: vi.fn().mockReturnValue(of({})) }
        },
        // The real storage and the real lock are the point of this describe -- see the comment
        // above.
        { provide: OutboxStorage, useClass: IndexedDbOutboxStorage },
        { provide: OutboxDrainLock, useClass: OutboxDrainLock },
        { provide: Router, useValue: { events: new Subject(), url: '/dashboard' } },
        { provide: MatSnackBar, useValue: { open: vi.fn(), openFromComponent: vi.fn() } },
        { provide: LiveAnnouncer, useValue: { announce: vi.fn().mockResolvedValue(undefined) } }
      ]
    });

    const effects = TestBed.inject(OutboxEffects);
    effects.hydrateOnInit$.subscribe();
    effects.persistEnqueue$.subscribe();
    effects.drainOnTrigger$.subscribe();
    effects.retry$.subscribe();
    effects.discard$.subscribe();
    effects.failureNoticeOnDrainCompleted$.subscribe();
    effects.failureNoticeOnSyncRequested$.subscribe();
    effects.reloadOnDrainCompleted$.subscribe((action) => dispatch(action));
    effects.announceAllSent$.subscribe();

    return { actions$, dispatched };
  }

  beforeEach(async () => {
    await deleteRealDb();
  });

  afterEach(async () => {
    await deleteRealDb();
  });

  it(
    'should_release_the_web_lock_and_run_a_later_pass_when_db_transaction_throws_synchronously_mid_drain',
    async () => {
      const h = setupWithRealStorageAndLock();
      const drainCompletedCount = (): number =>
        h.dispatched.filter((a) => a.type === OutboxActions.drainCompleted.type).length;

      // Boot hydration succeeds against the real, empty database and fires T1, which runs and
      // completes an uneventful first pass. This establishes P1 (hydration) and exercises the
      // real lock/storage pairing once before we break anything.
      h.actions$.next({ type: ROOT_EFFECTS_INIT });
      await waitUntil(() => drainCompletedCount() >= 1);

      // The *next* `db.transaction` call throws synchronously, exactly as a browser-force-closed
      // connection would (`InvalidStateError`). The next pass's unguarded initial `getAll`
      // (`outbox.effects.ts:303`) is that call.
      const transactionSpy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => {
        throw new DOMException('closed', 'InvalidStateError');
      });

      try {
        h.actions$.next(OutboxActions.drainRequested());

        // Bounded wait, not the runner's own timeout: a wedged lock must fail this assertion.
        await waitUntil(() => lockAvailable(), 3000);
      } finally {
        transactionSpy.mockRestore();
      }

      // The lock being free is necessary but not sufficient on its own: a later trigger must also
      // run an entirely new pass to completion against the now-healthy (reopened) connection.
      const passesBefore = drainCompletedCount();
      h.actions$.next(OutboxActions.drainRequested());
      await waitUntil(() => drainCompletedCount() > passesBefore);
    },
    15000
  );
});
