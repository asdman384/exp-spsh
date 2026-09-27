import 'src/logger';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { AppActions } from 'src/@state/app.actions';
import { FAILURE_MESSAGES } from 'src/@state/report-failure';
import { Expense, OutboxRecord } from 'src/shared/models';

import { NetworkStatusService } from '../network-status.service';
import { AbstractSecurityService } from '../security';
import { SpreadsheetService } from '../spreadsheet/spreadsheet.service';
import { IndexedDbOutboxStorage } from './indexed-db-outbox-storage.service';
import { InMemoryOutboxStorage } from './in-memory-outbox-storage';
import { OUTBOX_MESSAGES } from './outbox-messages';
import { OutboxStorage } from './outbox-storage';
import { OutboxService } from './outbox.service';

function makeExpense(comment = ''): Expense {
  return { date: new Date(2024, 0, 1), amount: 10, category: 'Food', comment, isInDebt: false };
}

function makeRecord(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
  return {
    localId: 'r-1',
    kind: 'addExpense',
    spreadsheetId: 'spsh-1',
    payload: { sheetId: 3, expense: makeExpense() },
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
      throw new Error('waitFor: timed out');
    }
    await wait(5);
  }
}

function seed(storage: OutboxStorage, ...records: Array<OutboxRecord>): Promise<void> {
  return records.reduce(
    (chain, record) => chain.then(() => new Promise<void>((resolve) => storage.add(record).subscribe(() => resolve()))),
    Promise.resolve()
  );
}

function readAll(storage: OutboxStorage): Promise<Array<OutboxRecord>> {
  return new Promise((resolve) => storage.getAll().subscribe((records) => resolve(records)));
}

/** Wraps the private `runPass` so a test can count drain passes that got past the preconditions
 * and ran to completion; a pass that throws is not counted. */
function countCompletedPasses(service: OutboxService): () => number {
  const target = service as unknown as { runPass: () => Promise<void> };
  const runPass = target.runPass.bind(service);
  let completed = 0;
  target.runPass = async () => {
    await runPass();
    completed++;
  };
  return () => completed;
}

interface Harness {
  service: OutboxService;
  dispatch: ReturnType<typeof vi.fn>;
  storage: OutboxStorage;
  /** Drain passes that got past the preconditions and ran to completion. */
  completedPasses: () => number;
  sent: Array<OutboxRecord>;
  online$: BehaviorSubject<boolean>;
  user$: BehaviorSubject<{ name: string } | undefined>;
  getSpreadsheetId: ReturnType<typeof vi.fn>;
  addExpense: ReturnType<typeof vi.fn>;
  router: { events: Subject<unknown>; url: string };
  openFromComponent: ReturnType<typeof vi.fn>;
  announce: ReturnType<typeof vi.fn>;
  setChoice: (choice: 'retry' | 'discard' | 'close' | null) => void;
}

function setup(options: { storage?: OutboxStorage; spreadsheetId?: string } = {}): Harness {
  const dispatch = vi.fn();
  const online$ = new BehaviorSubject<boolean>(true);
  const user$ = new BehaviorSubject<{ name: string } | undefined>({ name: 'Oleg' });
  const getSpreadsheetId = vi.fn().mockReturnValue(options.spreadsheetId ?? 'spsh-1');
  const addExpense = vi.fn();
  const router = { events: new Subject<unknown>(), url: '/dashboard' };
  let choiceValue: 'retry' | 'discard' | 'close' | null = null;
  const openFromComponent = vi.fn().mockImplementation(() => ({
    instance: { choice: () => choiceValue },
    afterDismissed: () => of(undefined)
  }));
  const announce = vi.fn().mockResolvedValue(undefined);

  const storage = options.storage ?? new InMemoryOutboxStorage();

  TestBed.configureTestingModule({
    providers: [
      { provide: Store, useValue: { dispatch } },
      { provide: NetworkStatusService, useValue: { online$ } },
      { provide: AbstractSecurityService, useValue: { user$ } },
      { provide: SpreadsheetService, useValue: { getSpreadsheetId, addExpense } },
      { provide: OutboxStorage, useValue: storage },
      { provide: Router, useValue: router },
      { provide: MatSnackBar, useValue: { open: vi.fn(), openFromComponent } },
      { provide: LiveAnnouncer, useValue: { announce } }
    ]
  });

  const service = TestBed.inject(OutboxService);
  const completedPasses = countCompletedPasses(service);
  const sent: Array<OutboxRecord> = [];
  service.sent$.subscribe((record) => sent.push(record));

  return {
    service,
    dispatch,
    storage,
    completedPasses,
    sent,
    online$,
    user$,
    getSpreadsheetId,
    addExpense,
    router,
    openFromComponent,
    announce,
    setChoice: (c) => (choiceValue = c)
  };
}

/** Boot: hydration plus the T1 pass it starts. */
function init(h: Harness): Promise<void> {
  h.service.init();
  return waitFor(() => h.completedPasses() >= 1);
}

let originalLog: unknown;

beforeEach(() => {
  originalLog = (globalThis as unknown as { log: unknown }).log;
});

afterEach(() => {
  (globalThis as unknown as { log: unknown }).log = originalLog;
});

describe('OutboxService', () => {
  describe('hydration', () => {
    it('should_call_getAll_once_and_mirror_the_stored_records_on_init', async () => {
      const storage = new InMemoryOutboxStorage();
      await seed(storage, makeRecord({ localId: 'seed', status: 'failed' }));
      const getAllSpy = vi.spyOn(storage, 'getAll');
      const h = setup({ storage });

      h.service.init();
      await waitFor(() => h.service.records().length === 1);

      expect(getAllSpy).toHaveBeenCalledTimes(1);
      expect(h.service.records().map((r) => r.localId)).toEqual(['seed']);
      expect(h.service.failedCount()).toBe(1);
    });

    it('should_hydrate_only_once_when_init_is_called_twice', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });

      h.service.init();
      h.service.init();
      await wait(50);

      // one read for hydration, then the T1 pass's own reads
      expect(h.completedPasses()).toBe(1);
    });

    it('should_not_touch_storage_when_isAvailable_is_false_and_no_pass_ever_runs', async () => {
      const storage = new ControllableOutboxStorage();
      storage.isAvailable.mockReturnValue(false);
      const h = setup({ storage });

      h.service.init();
      await wait(50);
      h.service.sync();
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.completedPasses()).toBe(0);
    });

    it('should_log_and_never_run_a_pass_when_getAll_errors_at_hydration', async () => {
      const storage = new ControllableOutboxStorage();
      storage.getAll.mockReturnValue(throwError(() => new Error('boom')));
      const h = setup({ storage });
      const logSpy = vi.fn();
      (globalThis as unknown as { log: unknown }).log = logSpy;

      h.service.init();
      await wait(50);

      expect(logSpy).toHaveBeenCalled();
      expect(h.service.records()).toEqual([]);

      const callsBefore = storage.getAll.mock.calls.length;
      h.service.sync();
      await wait(50);

      expect(storage.getAll.mock.calls.length).toBe(callsBefore);
      expect(h.completedPasses()).toBe(0);
    });
  });

  describe('add (persist-first)', () => {
    it('should_persist_a_pending_record_with_exactly_the_five_expense_keys', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });

      h.service.add(7, { ...makeExpense('lunch'), extra: 'ignored' } as Expense);
      await waitFor(() => h.service.records().length === 1);

      const [record] = storage.add.mock.calls[0] as [OutboxRecord];
      expect(record).toEqual<OutboxRecord>({
        localId: expect.any(String),
        kind: 'addExpense',
        spreadsheetId: 'spsh-1',
        payload: { sheetId: 7, expense: makeExpense('lunch') },
        enqueuedAt: expect.any(Number),
        status: 'pending',
        attempts: 0
      });
      expect(Object.keys(record.payload.expense).sort()).toEqual(['amount', 'category', 'comment', 'date', 'isInDebt']);
    });

    it('should_add_the_record_then_start_a_pass_and_announce_queued', async () => {
      const h = setup();
      await init(h);
      h.addExpense.mockReturnValue(new Subject()); // keep the send in flight

      h.service.add(3, makeExpense());
      await waitFor(() => h.addExpense.mock.calls.length === 1);

      expect(h.service.pendingCount()).toBe(1);
      expect(h.announce).toHaveBeenCalledWith(OUTBOX_MESSAGES.queued, 'polite');
    });

    it('should_dispatch_loading_false_and_operationFailed_and_keep_nothing_when_the_add_fails', async () => {
      const storage = new ControllableOutboxStorage();
      storage.add.mockReturnValue(throwError(() => new Error('disk full')));
      const h = setup({ storage });

      h.service.add(3, makeExpense());
      await waitFor(() => h.dispatch.mock.calls.length > 0);

      expect(h.dispatch).toHaveBeenCalledWith(AppActions.loading({ loading: false }));
      expect(h.dispatch).toHaveBeenCalledWith(
        AppActions.operationFailed({ source: 'addExpense$', message: FAILURE_MESSAGES.addExpense$ })
      );
      expect(h.service.records()).toEqual([]);
      expect(h.announce).not.toHaveBeenCalled();
    });

    it('should_persist_two_adds_in_call_order', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });

      h.service.add(3, makeExpense('a'));
      h.service.add(3, makeExpense('b'));
      await waitFor(() => h.service.records().length === 2);

      const order = storage.add.mock.calls.map(([r]) => (r as OutboxRecord).payload.expense.comment);
      expect(order).toEqual(['a', 'b']);
    });
  });

  describe('triggers and coalescing (T1-T5, no hot loop)', () => {
    it('should_start_exactly_one_pass_on_T1_hydration', async () => {
      const h = setup();

      await init(h);
      await wait(30);

      expect(h.completedPasses()).toBe(1);
    });

    it('should_start_a_pass_on_T2_only_on_the_false_to_true_edge', async () => {
      const h = setup();
      await init(h);
      const baseline = h.completedPasses();

      h.online$.next(false); // true -> false: not a rising edge
      await wait(50);
      expect(h.completedPasses()).toBe(baseline);

      h.online$.next(true); // false -> true: rising edge, T2
      await waitFor(() => h.completedPasses() === baseline + 1);
    });

    it('should_start_a_pass_on_T3_NavigationEnd', async () => {
      const h = setup();
      await init(h);
      const baseline = h.completedPasses();

      h.router.events.next(new NavigationEnd(1, '/dashboard', '/dashboard'));

      await waitFor(() => h.completedPasses() === baseline + 1);
    });

    it('should_start_a_pass_on_T5_sync', async () => {
      const h = setup();
      await init(h);
      const baseline = h.completedPasses();

      h.service.sync();

      await waitFor(() => h.completedPasses() === baseline + 1);
    });

    it('should_coalesce_two_or_more_triggers_that_arrive_during_a_running_pass_into_exactly_one_extra_pass', async () => {
      const storage = new InMemoryOutboxStorage();
      await seed(storage, makeRecord({ localId: 'gated' }));
      const h = setup({ storage });
      const sendGate = new Subject<unknown>();
      h.addExpense.mockReturnValue(sendGate);

      // T1 starts pass #1, which blocks mid-send on `sendGate`.
      h.service.init();
      await waitFor(() => h.addExpense.mock.calls.length === 1);

      // Two more triggers arrive while pass #1 is still running.
      h.service.sync();
      h.router.events.next(new NavigationEnd(1, '/dashboard', '/dashboard'));
      await wait(30);
      expect(h.completedPasses()).toBe(0);

      sendGate.next({});
      await waitFor(() => h.completedPasses() === 2, 3000); // pass #1, then exactly one coalesced extra pass

      expect(h.addExpense).toHaveBeenCalledTimes(1); // the coalesced pass found nothing left to send
      await wait(100);
      expect(h.completedPasses()).toBe(2);
    });

    it('should_make_exactly_one_addExpense_call_when_a_single_retryable_failure_has_no_further_triggers', async () => {
      const storage = new InMemoryOutboxStorage();
      await seed(storage, makeRecord({ localId: 'flaky' }));
      const h = setup({ storage });
      h.addExpense.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

      await init(h);
      await wait(100);

      expect(h.addExpense).toHaveBeenCalledTimes(1);
      expect(h.completedPasses()).toBe(1);
      expect(h.service.records()[0]).toMatchObject({ status: 'pending', attempts: 1 });
    });
  });

  describe('preconditions P1-P4', () => {
    it('should_make_zero_storage_and_send_calls_when_P1_hydration_has_not_completed', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });

      h.service.sync();
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.completedPasses()).toBe(0);
      expect(h.addExpense).not.toHaveBeenCalled();
    });

    it('should_make_zero_storage_and_send_calls_when_P2_online_is_false', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });
      await init(h);

      h.online$.next(false);
      storage.getAll.mockClear();

      h.service.sync();
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.completedPasses()).toBe(1);
      expect(h.addExpense).not.toHaveBeenCalled();
    });

    it('should_make_zero_storage_calls_when_P3_user_is_undefined', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });
      await init(h);

      h.user$.next(undefined);
      storage.getAll.mockClear();

      h.service.sync();
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.completedPasses()).toBe(1);
    });

    it('should_make_zero_storage_calls_when_P4_spreadsheet_id_is_empty', async () => {
      const storage = new ControllableOutboxStorage();
      const h = setup({ storage });
      await init(h);

      h.getSpreadsheetId.mockReturnValue('');
      storage.getAll.mockClear();

      h.service.sync();
      await wait(50);

      expect(storage.getAll).not.toHaveBeenCalled();
      expect(h.completedPasses()).toBe(1);
    });

    it('should_start_a_pass_that_sends_via_NavigationEnd_once_P3_and_P4_become_true', async () => {
      const storage = new ControllableOutboxStorage();
      // Not yet signed in, so hydration's own T1 pass attempt aborts at P3.
      const h = setup({ storage, spreadsheetId: '' });
      h.user$.next(undefined);

      h.service.init();
      await waitFor(() => storage.getAll.mock.calls.length >= 1);
      const record = makeRecord({ localId: 'ready' });
      // `ControllableOutboxStorage` is a static stub: after the record is sent it must stop being
      // returned, or the sessionSent guard would loop re-attempting its removal. Two reads see
      // the record (the pass's initial snapshot, then the loop's first fresh read that sends it).
      storage.getAll.mockReturnValueOnce(of([record])).mockReturnValueOnce(of([record])).mockReturnValue(of([]));
      h.addExpense.mockReturnValue(of({}));

      h.user$.next({ name: 'Oleg' });
      h.getSpreadsheetId.mockReturnValue('spsh-1');
      h.router.events.next(new NavigationEnd(1, '/dashboard', '/dashboard'));

      await waitFor(() => h.addExpense.mock.calls.length === 1);
      expect(h.addExpense).toHaveBeenCalledWith(record.payload.sheetId, record.payload.expense);
    });
  });

  describe('pass algorithm', () => {
    it('should_mirror_storage_in_records_at_the_end_of_a_pass', async () => {
      const storage = new InMemoryOutboxStorage();
      await seed(storage, makeRecord({ localId: 'kept', status: 'failed', failure: 'rejected' }));
      const h = setup({ storage });

      await init(h);

      expect(h.service.records()).toEqual(await readAll(storage));
    });

    it('should_send_strictly_FIFO_one_in_flight_at_a_time_by_enqueuedAt_then_localId', async () => {
      const storage = new InMemoryOutboxStorage();
      const a = makeRecord({ localId: 'a', enqueuedAt: 1000 });
      const b = makeRecord({ localId: 'b', enqueuedAt: 2000 });
      await seed(storage, b, a);
      const h = setup({ storage });
      const gates: Array<Subject<unknown>> = [new Subject(), new Subject()];
      let call = 0;
      h.addExpense.mockImplementation(() => gates[call++]);

      h.service.init();
      await waitFor(() => h.addExpense.mock.calls.length === 1);
      expect(h.addExpense).toHaveBeenNthCalledWith(1, a.payload.sheetId, a.payload.expense);

      await wait(50);
      expect(h.addExpense).toHaveBeenCalledTimes(1); // second call must wait for the first to emit

      gates[0].next({});
      await waitFor(() => h.addExpense.mock.calls.length === 2);
      expect(h.addExpense).toHaveBeenNthCalledWith(2, b.payload.sheetId, b.payload.expense);

      gates[1].next({});
      await waitFor(() => h.completedPasses() === 1);
      expect(h.service.records()).toEqual([]);
      expect(h.sent.map((r) => r.localId)).toEqual(['b']); // the last sent record, once per pass
    });

    it('should_read_fresh_before_every_item_so_a_record_removed_between_iterations_is_skipped', async () => {
      const storage = new ControllableOutboxStorage();
      const a = makeRecord({ localId: 'a', enqueuedAt: 1000 });
      const b = makeRecord({ localId: 'b', enqueuedAt: 2000 });
      storage.getAll
        .mockReturnValueOnce(of([a, b])) // hydration
        .mockReturnValueOnce(of([a, b])) // pass initial snapshot
        .mockReturnValueOnce(of([a, b])) // loop fresh read #1 -> picks a
        .mockReturnValueOnce(of([])) // loop fresh read #2 -> b was removed by "another tab"
        .mockReturnValue(of([])); // final read
      const h = setup({ storage });
      h.addExpense.mockReturnValue(of({}));

      await init(h);

      expect(h.addExpense).toHaveBeenCalledTimes(1);
      expect(h.addExpense).toHaveBeenCalledWith(a.payload.sheetId, a.payload.expense);
    });

    it('should_not_send_and_should_continue_the_pass_on_a_spreadsheet_mismatch', async () => {
      const storage = new InMemoryOutboxStorage();
      const mismatched = makeRecord({ localId: 'mismatch', enqueuedAt: 1000, spreadsheetId: 'other-sheet' });
      const matching = makeRecord({ localId: 'match', enqueuedAt: 2000 });
      await seed(storage, mismatched, matching);
      const h = setup({ storage });
      h.addExpense.mockReturnValue(of({}));

      await init(h);

      expect(h.addExpense).toHaveBeenCalledTimes(1);
      expect(h.addExpense).toHaveBeenCalledWith(matching.payload.sheetId, matching.payload.expense);
      expect(h.service.records()).toEqual([
        expect.objectContaining({ localId: 'mismatch', status: 'failed', failure: 'otherSpreadsheet' })
      ]);
      expect(h.sent.map((r) => r.localId)).toEqual(['match']);
      expect(h.openFromComponent).toHaveBeenCalledTimes(1); // newly failed -> notice
    });

    it('should_never_resend_a_localId_already_sent_this_session_even_if_remove_keeps_failing', async () => {
      const storage = new ControllableOutboxStorage();
      const record = makeRecord({ localId: 'stuck' });
      storage.getAll.mockReturnValue(of([record])); // remove never actually clears it from this stub
      storage.remove.mockReturnValue(throwError(() => new Error('remove failed')));
      const h = setup({ storage });
      h.addExpense.mockReturnValue(of({}));

      await init(h);

      expect(h.addExpense).toHaveBeenCalledTimes(1);
      expect(h.sent).toHaveLength(1);
    });

    it('should_stop_the_pass_before_the_next_send_when_going_offline_mid_pass', async () => {
      const storage = new InMemoryOutboxStorage();
      await seed(storage, makeRecord({ localId: 'a', enqueuedAt: 1000 }), makeRecord({ localId: 'b', enqueuedAt: 2000 }));
      const h = setup({ storage });
      const gate = new Subject<unknown>();
      h.addExpense.mockReturnValueOnce(gate).mockReturnValue(of({}));

      h.service.init();
      await waitFor(() => h.addExpense.mock.calls.length === 1);

      h.online$.next(false); // go offline while 'a' is in flight
      gate.next({}); // 'a' succeeds; the online check before the *next* item should now fail

      await waitFor(() => h.completedPasses() === 1);
      expect(h.addExpense).toHaveBeenCalledTimes(1); // 'b' was never attempted
      expect(h.service.pendingCount()).toBe(1);
    });
  });

  describe('auth toast, once per episode', () => {
    it('should_dispatch_operationFailed_outboxDrain_on_the_first_auth_stop_not_on_a_second_consecutive_one_and_again_after_a_success', async () => {
      const storage = new InMemoryOutboxStorage();
      await seed(storage, makeRecord({ localId: 'auth-record-1' }));
      const h = setup({ storage });

      const authError = () => throwError(() => new HttpErrorResponse({ status: 401 }));
      const authToastCount = () =>
        h.dispatch.mock.calls.filter(
          ([a]) =>
            (a as { type: string }).type === AppActions.operationFailed.type &&
            (a as ReturnType<typeof AppActions.operationFailed>).source === 'outboxDrain$'
        ).length;

      // Pass 1: auth failure -> toast (episode start). The record stays pending.
      h.addExpense.mockReturnValueOnce(authError());
      h.service.init();
      await waitFor(() => h.completedPasses() === 1);
      expect(authToastCount()).toBe(1);

      // Pass 2: another consecutive auth failure -> no toast.
      h.addExpense.mockReturnValueOnce(authError());
      h.service.sync();
      await waitFor(() => h.completedPasses() === 2);
      expect(authToastCount()).toBe(1);

      // Pass 3: a success removes the record and resets the episode.
      h.addExpense.mockReturnValueOnce(of({}));
      h.service.sync();
      await waitFor(() => h.completedPasses() === 3);
      expect(authToastCount()).toBe(1);

      // Pass 4: a fresh record fails auth again -> a new episode.
      await seed(storage, makeRecord({ localId: 'auth-record-2', enqueuedAt: 2000 }));
      h.addExpense.mockReturnValueOnce(authError());
      h.service.sync();
      await waitFor(() => h.completedPasses() === 4);
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

  describe('announcements and sent$', () => {
    it('should_announce_allSent_and_emit_sent_when_everything_was_sent', async () => {
      const storage = new InMemoryOutboxStorage();
      const record = makeRecord({ localId: 'only' });
      await seed(storage, record);
      const h = setup({ storage });
      h.addExpense.mockReturnValue(of({}));

      await init(h);

      expect(h.announce).toHaveBeenCalledWith(OUTBOX_MESSAGES.allSent, 'polite');
      expect(h.sent).toEqual([record]);
    });

    it('should_not_announce_allSent_when_pending_records_remain_but_still_emit_sent', async () => {
      const storage = new InMemoryOutboxStorage();
      await seed(storage, makeRecord({ localId: 'a', enqueuedAt: 1 }), makeRecord({ localId: 'b', enqueuedAt: 2 }));
      const h = setup({ storage });
      h.addExpense.mockReturnValueOnce(of({})).mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

      await init(h);

      expect(h.announce).not.toHaveBeenCalledWith(OUTBOX_MESSAGES.allSent, expect.anything());
      expect(h.sent.map((r) => r.localId)).toEqual(['a']);
    });

    it('should_neither_announce_nor_emit_when_nothing_was_sent', async () => {
      const h = setup();

      await init(h);

      expect(h.announce).not.toHaveBeenCalledWith(OUTBOX_MESSAGES.allSent, expect.anything());
      expect(h.sent).toEqual([]);
    });
  });

  describe('failure notice, Retry/Discard/Close', () => {
    async function withFailedRecord(localId: string): Promise<{ h: Harness; storage: InMemoryOutboxStorage }> {
      const storage = new InMemoryOutboxStorage();
      await seed(storage, makeRecord({ localId, status: 'failed', failure: 'rejected', enqueuedAt: 1 }));
      const h = setup({ storage });
      await init(h);
      return { h, storage };
    }

    it('should_open_the_notice_with_the_oldest_failed_record_and_no_duration_after_a_terminal_failure', async () => {
      const storage = new InMemoryOutboxStorage();
      await seed(storage, makeRecord({ localId: 'F1' }));
      const h = setup({ storage });
      h.addExpense.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));

      await init(h);

      expect(h.openFromComponent).toHaveBeenCalledTimes(1);
      const [component, config] = h.openFromComponent.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(component).toBeDefined();
      expect((config['data'] as { record: OutboxRecord }).record).toMatchObject({
        localId: 'F1',
        status: 'failed',
        failure: 'rejected',
        attempts: 1
      });
      expect(config['politeness']).toBe('assertive');
      expect(config['verticalPosition']).toBe('top');
      expect(config).not.toHaveProperty('duration');
    });

    it('should_open_the_notice_on_sync_while_a_failed_record_exists_and_also_start_a_pass', async () => {
      const { h } = await withFailedRecord('F2');
      expect(h.openFromComponent).not.toHaveBeenCalled(); // not newly failed during the boot pass
      const passesBefore = h.completedPasses();

      h.service.sync();
      await waitFor(() => h.completedPasses() === passesBefore + 1);

      expect(h.openFromComponent).toHaveBeenCalledTimes(1);
      const [, config] = h.openFromComponent.mock.calls[0] as [unknown, Record<string, unknown>];
      expect((config['data'] as { record: OutboxRecord }).record.localId).toBe('F2');
    });

    it('should_not_open_the_notice_on_sync_when_no_failed_record_exists', async () => {
      const h = setup();

      h.service.sync();
      await wait(50);

      expect(h.openFromComponent).not.toHaveBeenCalled();
    });

    it('should_map_retry_to_updateStatus_pending_and_then_send_it', async () => {
      const { h, storage } = await withFailedRecord('F3');
      h.addExpense.mockReturnValue(new Subject()); // keep the resend in flight
      h.setChoice('retry');

      h.service.sync();
      await waitFor(() => h.addExpense.mock.calls.length === 1);

      const updated = await readAll(storage);
      expect(updated.find((r) => r.localId === 'F3')).toMatchObject({ status: 'pending', failure: undefined });
      expect(h.service.pendingCount()).toBe(1);
    });

    it('should_map_discard_to_remove_with_no_send', async () => {
      const { h, storage } = await withFailedRecord('F4');
      h.setChoice('discard');

      h.service.sync();
      await waitFor(() => h.service.records().length === 0);
      await wait(50);

      expect(await readAll(storage)).toEqual([]);
      expect(h.addExpense).not.toHaveBeenCalled();
    });

    it('should_do_nothing_when_the_choice_is_close', async () => {
      const { h, storage } = await withFailedRecord('F5');
      h.setChoice('close');

      h.service.sync();
      await waitFor(() => h.openFromComponent.mock.calls.length === 1);
      await wait(50);

      expect(await readAll(storage)).toEqual([expect.objectContaining({ localId: 'F5', status: 'failed' })]);
      expect(h.addExpense).not.toHaveBeenCalled();
    });

    it('should_do_nothing_when_there_is_no_choice_at_all', async () => {
      const { h, storage } = await withFailedRecord('F6');
      h.setChoice(null);

      h.service.sync();
      await waitFor(() => h.openFromComponent.mock.calls.length === 1);
      await wait(50);

      expect(await readAll(storage)).toEqual([expect.objectContaining({ localId: 'F6', status: 'failed' })]);
      expect(h.addExpense).not.toHaveBeenCalled();
    });
  });
});

// RR-9 item 1 regression (docs/reviews/write-outbox.md "Re-review 1", blocking item 1): the drain
// pass must not wedge the single-flight state when the *real* `IndexedDbOutboxStorage`'s
// `db.transaction(...)` throws synchronously (e.g. `InvalidStateError` on a browser-force-closed
// connection). A storage stub that errors via RxJS would pass against the pre-fix code too,
// because the hang lived inside `IndexedDbOutboxStorage.withStore` -- so this uses the real
// storage.
describe('OutboxService drain pass with the real IndexedDbOutboxStorage (RR-9 item 1)', () => {
  const DB_NAME = 'exp-spsh-outbox';

  function deleteRealDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error as unknown);
      request.onblocked = () => resolve();
    });
  }

  async function waitUntil(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('waitUntil: timed out');
      }
      await wait(20);
    }
  }

  beforeEach(async () => {
    await deleteRealDb();
  });

  afterEach(async () => {
    await deleteRealDb();
  });

  it(
    'should_run_a_later_pass_when_db_transaction_throws_synchronously_mid_drain',
    async () => {
      TestBed.configureTestingModule({
        providers: [
          { provide: Store, useValue: { dispatch: vi.fn() } },
          { provide: NetworkStatusService, useValue: { online$: new BehaviorSubject(true) } },
          { provide: AbstractSecurityService, useValue: { user$: new BehaviorSubject({ name: 'Oleg' }) } },
          {
            provide: SpreadsheetService,
            useValue: { getSpreadsheetId: () => 'spsh-1', addExpense: vi.fn().mockReturnValue(of({})) }
          },
          // The real storage is the point of this describe.
          { provide: OutboxStorage, useClass: IndexedDbOutboxStorage },
          { provide: Router, useValue: { events: new Subject(), url: '/dashboard' } },
          { provide: MatSnackBar, useValue: { open: vi.fn(), openFromComponent: vi.fn() } },
          { provide: LiveAnnouncer, useValue: { announce: vi.fn().mockResolvedValue(undefined) } }
        ]
      });
      const service = TestBed.inject(OutboxService);
      const completedPasses = countCompletedPasses(service);

      // Boot hydration succeeds against the real, empty database and runs an uneventful T1 pass.
      service.init();
      await waitUntil(() => completedPasses() >= 1);

      // The *next* `db.transaction` call throws synchronously, exactly as a browser-force-closed
      // connection would. The next pass's unguarded initial `getAll` is that call.
      const transactionSpy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => {
        throw new DOMException('closed', 'InvalidStateError');
      });

      try {
        service.sync();
        await waitUntil(() => transactionSpy.mock.calls.length >= 1);
      } finally {
        transactionSpy.mockRestore();
      }

      // A later trigger must run an entirely new pass to completion. Were the failed pass wedged,
      // this trigger would only coalesce behind it and the bounded wait would time out.
      const passesBefore = completedPasses();
      service.sync();
      await waitUntil(() => completedPasses() > passesBefore);
    },
    15000
  );
});
