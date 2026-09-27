import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { AppActions } from 'src/@state';
import { FAILURE_MESSAGES } from 'src/@state/report-failure';
import { NetworkStatusService, OutboxService, SpreadsheetService } from 'src/services';
import { Expense, OutboxRecord, Sheet } from 'src/shared/models';

import { ExpensesService } from './expenses.service';

function makeExpense(comment: string): Expense {
  return { category: 'Food', comment, amount: 12.5, date: new Date(2024, 0, 16, 12, 14, 23), isInDebt: false };
}

describe('ExpensesService', () => {
  let outbox: { add: ReturnType<typeof vi.fn>; sent$: Subject<OutboxRecord> };
  let dispatch: ReturnType<typeof vi.fn>;
  let online$: BehaviorSubject<boolean>;
  let router: { url: string };
  let spreadsheet: {
    getSpreadsheetId: ReturnType<typeof vi.fn>;
    loadExpenses: ReturnType<typeof vi.fn>;
    loadLastExpenses: ReturnType<typeof vi.fn>;
    deleteSheetRow: ReturnType<typeof vi.fn>;
  };
  let service: ExpensesService;

  const sheet: Sheet = { id: 99, title: 'Sheet1' };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- `log` is a global installed by main.ts; tests only need it to exist
    (globalThis as unknown as { log: (...args: unknown[]) => void }).log = () => {};
    outbox = { add: vi.fn(), sent$: new Subject<OutboxRecord>() };
    dispatch = vi.fn();
    online$ = new BehaviorSubject(true);
    router = { url: '/dashboard' };
    spreadsheet = {
      getSpreadsheetId: vi.fn().mockReturnValue('spsh-1'),
      loadExpenses: vi.fn().mockReturnValue(of([])),
      loadLastExpenses: vi.fn(),
      deleteSheetRow: vi.fn().mockReturnValue(of({}))
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: OutboxService, useValue: outbox },
        { provide: Store, useValue: { dispatch } },
        { provide: NetworkStatusService, useValue: { online$ } },
        { provide: SpreadsheetService, useValue: spreadsheet },
        { provide: Router, useValue: router }
      ]
    });

    service = TestBed.inject(ExpensesService);
  });

  afterEach(() => {
    delete (globalThis as unknown as { log?: unknown }).log;
  });

  describe('add', () => {
    it('should_hand_the_expense_to_the_outbox_and_not_call_the_spreadsheet', () => {
      const expense = makeExpense('lunch');

      service.add(3, expense);

      expect(outbox.add).toHaveBeenCalledWith(3, expense);
      expect(spreadsheet.loadExpenses).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('load', () => {
    it('should_store_the_loaded_expenses_and_toggle_loading', () => {
      const loaded = [makeExpense('a')];
      spreadsheet.loadExpenses.mockReturnValue(of(loaded));

      service.load({ sheetId: 1 });

      expect(spreadsheet.loadExpenses).toHaveBeenCalledWith({ sheetId: 1 });
      expect(service.expenses()).toEqual(loaded);
      expect(dispatch).toHaveBeenCalledWith(AppActions.loading({ loading: true }));
      expect(dispatch).toHaveBeenLastCalledWith(AppActions.loading({ loading: false }));
    });

    it('should_wait_until_online_and_then_load', () => {
      online$.next(false);

      service.load({ sheetId: 1 });
      expect(spreadsheet.loadExpenses).not.toHaveBeenCalled();

      online$.next(true);
      expect(spreadsheet.loadExpenses).toHaveBeenCalledTimes(1);
    });

    it('should_report_loadExpenses_failure_and_keep_the_previous_list', () => {
      spreadsheet.loadExpenses.mockReturnValue(of([makeExpense('a')]));
      service.load({ sheetId: 1 });
      spreadsheet.loadExpenses.mockReturnValue(throwError(() => new Error('boom')));

      service.load({ sheetId: 1 });

      expect(service.expenses()).toEqual([makeExpense('a')]);
      expect(dispatch).toHaveBeenCalledWith(
        AppActions.operationFailed({ source: 'loadExpenses$', message: FAILURE_MESSAGES.loadExpenses$ })
      );
    });
  });

  // deleteSheetRow gets the index of the target in a fresh read of the last 100 rows, not its
  // position in the (possibly stale) list used only for the optimistic removal.
  describe('delete', () => {
    function seed(expenses: Array<Expense>): void {
      spreadsheet.loadExpenses.mockReturnValue(of(expenses));
      service.load({ sheetId: sheet.id });
    }

    it('should_pass_the_index_found_in_the_reloaded_100_row_window_to_deleteSheetRow_not_the_list_index', () => {
      const target = makeExpense('lunch');
      const old = [makeExpense('a'), target, makeExpense('b')];
      seed(old);
      const reloaded = ['x0', 'x1', 'x2', 'x3', 'x4', 'lunch', 'x6'].map(makeExpense);
      spreadsheet.loadLastExpenses.mockReturnValue(of(reloaded));

      service.delete(sheet, target);

      expect(spreadsheet.loadLastExpenses).toHaveBeenCalledWith(sheet.title, 100);
      expect(spreadsheet.deleteSheetRow).toHaveBeenCalledWith(sheet.id, 5);
      expect(service.expenses()).toEqual([old[0], old[2]]);
      expect(dispatch).toHaveBeenLastCalledWith(AppActions.loading({ loading: false }));
    });

    it('should_restore_the_row_and_report_failure_when_the_expense_is_not_in_the_last_100_rows', () => {
      const target = makeExpense('lunch');
      const old = [makeExpense('a'), target, makeExpense('b')];
      seed(old);
      spreadsheet.loadLastExpenses.mockReturnValue(of([makeExpense('x0'), makeExpense('x1')]));

      service.delete(sheet, target);

      expect(spreadsheet.deleteSheetRow).not.toHaveBeenCalled();
      expect(service.expenses()).toEqual(old);
      expect(dispatch).toHaveBeenCalledWith(
        AppActions.operationFailed({ source: 'deleteExpense$', message: FAILURE_MESSAGES.deleteExpense$ })
      );
    });

    it('should_clamp_the_restore_position_when_the_list_has_shrunk_below_the_backup_index', () => {
      const target = makeExpense('lunch');
      seed([makeExpense('a'), makeExpense('b'), makeExpense('c'), target]); // backup index 3
      const lastRows$ = new Subject<Array<Expense>>();
      spreadsheet.loadLastExpenses.mockReturnValue(lastRows$);

      service.delete(sheet, target);
      seed([makeExpense('only')]); // the list shrinks while the delete is in flight
      lastRows$.next([makeExpense('x0')]); // target absent -> restore

      expect(service.expenses()).toEqual([makeExpense('only'), target]);
    });
  });

  describe('reload after the outbox sends', () => {
    const lastSent: OutboxRecord = {
      localId: 'r-1',
      kind: 'addExpense',
      spreadsheetId: 'spsh-1',
      payload: { sheetId: 3, expense: makeExpense('lunch') },
      enqueuedAt: 1000,
      status: 'pending',
      attempts: 0
    };

    it('should_load_the_day_of_the_last_sent_record_when_on_dashboard', () => {
      outbox.sent$.next(lastSent);

      const to = new Date(lastSent.payload.expense.date!);
      to.setDate(to.getDate() + 1);
      expect(spreadsheet.loadExpenses).toHaveBeenCalledTimes(1);
      expect(spreadsheet.loadExpenses).toHaveBeenCalledWith({
        sheetId: 3,
        from: lastSent.payload.expense.date,
        to
      });
    });

    it('should_not_reload_on_a_dashboard_sub_route', () => {
      router.url = '/dashboard/statistics';

      outbox.sent$.next(lastSent);

      expect(spreadsheet.loadExpenses).not.toHaveBeenCalled();
    });
  });
});
