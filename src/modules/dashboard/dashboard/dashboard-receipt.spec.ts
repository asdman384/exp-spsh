import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { categoriesSelector, currentSheetSelector, loadingSelector } from 'src/@state';
import { ExpenseRecognitionService, VoiceRecorderService } from 'src/services';
import { ReceiptExpense } from 'src/services/expense-recognition/receipt-recognition';
import { OutboxService } from 'src/services/outbox/outbox.service';
import { ExpensesService } from '../expenses.service';
import { DashboardPageViewModel } from './dashboard-page.view-model';

describe('Dashboard receipt draft', () => {
  const day = new Date(2026, 10, 7, 12);
  const photo = new Blob(['receipt'], { type: 'image/jpeg' });
  const row: ReceiptExpense = { amount: 12, category: 'Food', date: day, comment: 'bread' };
  let model: DashboardPageViewModel;
  let result: Subject<ReceiptExpense[]>;
  let categories: BehaviorSubject<{ id: number; name: string }[]>;
  let spreadsheet: ReturnType<typeof signal<string | undefined>>;
  let loading: BehaviorSubject<boolean>;
  let recognizeReceipt: ReturnType<typeof vi.fn>;
  let add: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('log', vi.fn());
    result = new Subject();
    categories = new BehaviorSubject([
      { id: 0, name: 'Food' },
      { id: 1, name: 'Home' },
    ]);
    spreadsheet = signal('book');
    loading = new BehaviorSubject(false);
    recognizeReceipt = vi.fn(() => result);
    add = vi.fn();
    dispatch = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        DashboardPageViewModel,
        {
          provide: Store,
          useValue: {
            selectSignal: () => spreadsheet,
            select: (selector: unknown) =>
              selector === currentSheetSelector
                ? of({ id: 1, title: 'A' })
                : selector === categoriesSelector
                  ? categories
                  : selector === loadingSelector
                    ? loading
                    : of([]),
            dispatch,
          },
        },
        { provide: ExpensesService, useValue: { expenses: signal([]), add, load: vi.fn() } },
        { provide: OutboxService, useValue: { records: signal([]) } },
        { provide: VoiceRecorderService, useValue: { latest: signal(null) } },
        { provide: ExpenseRecognitionService, useValue: { recognizeReceipt } },
      ],
    });
    model = TestBed.inject(DashboardPageViewModel);
    model.expenseModel.update(value => ({ ...value, date: day }));
    TestBed.tick();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('captures selection, holds rows for review, and queues edited rows once on confirmation', () => {
    model.recognizeReceipt(photo);
    expect(recognizeReceipt).toHaveBeenCalledExactlyOnceWith(photo, ['Food', 'Home'], day);
    expect(model.receiptState().kind).toBe('recognizing');
    expect(model.canReadReceipt()).toBe(false);
    model.changeDate(new Date(2026, 10, 8));
    result.next([row]);
    expect(add).not.toHaveBeenCalled();
    expect(model.receiptState().kind).toBe('review');
    const edited = [{ ...row, amount: 15, category: 'Home', comment: 'soap', date: new Date(2026, 10, 1) }];
    model.confirmReceipt(edited);
    model.confirmReceipt(edited);
    expect(add).toHaveBeenCalledExactlyOnceWith(1, edited[0]);
    expect(model.receiptState().kind).toBe('idle');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('cancels an active request and ignores late results', () => {
    model.recognizeReceipt(photo);
    expect(result.observed).toBe(true);
    model.cancelReceipt();
    expect(result.observed).toBe(false);
    result.next([row]);
    expect(model.receiptState().kind).toBe('idle');
    expect(add).not.toHaveBeenCalled();
  });

  it.each(['person', 'spreadsheet', 'categories'] as const)('invalidates review on %s change', change => {
    model.recognizeReceipt(photo);
    result.next([row]);
    if (change === 'person') model.changeSheet({ id: 2, title: 'B' });
    if (change === 'spreadsheet') spreadsheet.set('other');
    if (change === 'categories') categories.next([{ id: 0, name: 'Other' }]);
    model.confirmReceipt([row]);
    TestBed.tick();
    expect(model.receiptState().kind).toBe('idle');
    expect(add).not.toHaveBeenCalled();
  });

  it.each(['person', 'spreadsheet', 'categories'] as const)('cancels recognition on %s change', change => {
    model.recognizeReceipt(photo);
    if (change === 'person') model.changeSheet({ id: 2, title: 'B' });
    if (change === 'spreadsheet') spreadsheet.set('other');
    if (change === 'categories') categories.next([{ id: 0, name: 'Other' }]);
    TestBed.tick();
    expect(result.observed).toBe(false);
    result.next([row]);
    expect(model.receiptState().kind).toBe('idle');
  });

  it.each(
    [[], [{ ...row, amount: 0 }], [{ ...row, amount: Infinity }], [{ ...row, category: 'Unknown' }], [{ ...row, date: new Date(NaN) }]].map(
      rows => ({ rows }),
    ),
  )('keeps invalid edited batches out of the queue', ({ rows }) => {
    model.recognizeReceipt(photo);
    result.next([row]);
    model.confirmReceipt(rows);
    expect(add).not.toHaveBeenCalled();
    expect(model.receiptState().kind).toBe('review');
    expect(model.receiptError()).toBeTruthy();
  });

  it('keeps edited rows with the same category and strips extra payload fields', () => {
    model.recognizeReceipt(photo);
    result.next([row]);
    model.confirmReceipt([{ ...row, isInDebt: true }, row] as ReceiptExpense[]);
    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenNthCalledWith(1, 1, row);
  });

  it('prevents overlap and requires a ready context', () => {
    loading.next(true);
    model.recognizeReceipt(photo);
    expect(recognizeReceipt).not.toHaveBeenCalled();
    loading.next(false);
    categories.next([]);
    model.recognizeReceipt(photo);
    expect(recognizeReceipt).not.toHaveBeenCalled();
    categories.next([{ id: 0, name: 'Food' }]);
    model.recognizeReceipt(photo);
    model.recognizeReceipt(photo);
    expect(recognizeReceipt).toHaveBeenCalledOnce();
  });

  it('shows a fixed error, releases busy state, and permits a new selection', () => {
    model.recognizeReceipt(photo);
    result.error(new Error('private model response'));
    expect(model.receiptError()).toBe('Could not read this receipt. Try a clearer photo.');
    expect(model.canReadReceipt()).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it('unsubscribes when the page is destroyed', () => {
    model.recognizeReceipt(photo);
    TestBed.resetTestingModule();
    expect(result.observed).toBe(false);
  });
});
