import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { currentSheetSelector } from 'src/@state';
import { ExpenseRecognitionService, VoiceRecorderService } from 'src/services';
import { OutboxService } from 'src/services/outbox/outbox.service';
import { Expense, OutboxRecord } from 'src/shared/models';
import { ExpensesService } from '../expenses.service';
import { DashboardPageViewModel } from './dashboard-page.view-model';

describe('DashboardPageViewModel expense dates', () => {
  it('filters by local calendar day and reacts to date and service changes', () => {
    const expenses = signal<Expense[]>([
      { amount: 1, date: new Date(2024, 0, 16) },
      { amount: 2, date: new Date(2024, 0, 16, 23, 59, 59) },
      { amount: 3, date: new Date(2024, 0, 17) },
      { amount: 4, date: new Date(2023, 0, 16) },
      { amount: 5, date: new Date(2024, 1, 16) },
      { amount: 6 }
    ]);
    TestBed.configureTestingModule({
      providers: [
        DashboardPageViewModel,
        { provide: OutboxService, useValue: { records: signal([]) } },
        { provide: Store, useValue: {
          select: (selector: unknown) => of(selector === currentSheetSelector ? undefined : []),
          selectSignal: () => signal('book'), dispatch: vi.fn()
        } },
        { provide: ExpensesService, useValue: { expenses } },
        { provide: VoiceRecorderService, useValue: { latest: signal(null) } },
        { provide: ExpenseRecognitionService, useValue: {} }
      ]
    });
    const model = TestBed.inject(DashboardPageViewModel);
    model.expenseModel.update((value) => ({ ...value, date: new Date(2024, 0, 16, 12) }));
    expect(model.expenses().map((expense) => expense.amount)).toEqual([1, 2]);

    model.expenseModel.update((value) => ({ ...value, date: new Date(2024, 0, 17) }));
    expect(model.expenses().map((expense) => expense.amount)).toEqual([3]);

    expenses.set([{ amount: 7, date: new Date(2024, 0, 17, 10) }]);
    expect(model.expenses().map((expense) => expense.amount)).toEqual([7]);
  });
});

describe('Dashboard running totals', () => {
  const day = new Date(2026, 10, 4, 12);
  let model: DashboardPageViewModel;
  let rows: ReturnType<typeof signal<Expense[]>>;
  let load: ReturnType<typeof vi.fn>;
  let add: ReturnType<typeof vi.fn>;
  let recording: ReturnType<typeof signal<import('src/shared/models').VoiceRecording | null>>;
  let recognize: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubGlobal('log', vi.fn());
    vi.useFakeTimers();
    vi.setSystemTime(day);
    rows = signal<Expense[]>([]);
    load = vi.fn(); add = vi.fn();
    recording = signal(null);
    recognize = vi.fn(() => of([{ amount: 9, date: day }]));
    TestBed.configureTestingModule({ providers: [DashboardPageViewModel,
        { provide: OutboxService, useValue: { records: signal([]) } },
      { provide: Store, useValue: { select: (selector: unknown) => of(selector === currentSheetSelector ? { id: 1, title: 'A' } : []), selectSignal: () => signal('book'), dispatch: vi.fn() } },
      { provide: ExpensesService, useValue: { expenses: rows, load, add } },
      { provide: VoiceRecorderService, useValue: { latest: recording } },
      { provide: ExpenseRecognitionService, useValue: { recognize } }
    ] });
    model = TestBed.inject(DashboardPageViewModel);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('keeps the form date for repeated submissions without reloading', () => {
    for (const hour of [13, 14]) {
      const now = new Date(2026, 10, 4, hour, 15, 32);
      vi.setSystemTime(now);
      model.expenseModel.update((value) => ({ ...value, amount: 9, category: 'Food' }));
      model.saveExpense();
      expect(add).toHaveBeenLastCalledWith(1, expect.objectContaining({ date: day }));
      expect(model.expenseModel().date).toEqual(day);
    }
    expect(load).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new Date(2024, 2, 1, 12), new Date(2024, 1, 29, 12)],
    [new Date(2026, 2, 30, 12), new Date(2026, 2, 29, 12)]
  ])('accepts the previous local day through changeDate from %s', (now, yesterday) => {
    vi.setSystemTime(now);
    model.changeDate(yesterday);
    expect(model.expenseModel().date).toEqual(yesterday);
    expect(load).toHaveBeenLastCalledWith({ sheetId: 1, to: yesterday });
  });

  it('keeps the form date when submitting after midnight without a resume', () => {
    const now = new Date(2027, 0, 1, 0, 5, 12);
    vi.setSystemTime(now);
    model.expenseModel.update((value) => ({ ...value, amount: 9, category: 'Food' }));
    expect(model.saveExpense()).toBe(true);
    expect(add).toHaveBeenLastCalledWith(1, expect.objectContaining({ date: day }));
    expect(model.expenseModel().date).toEqual(day);
    expect(load).toHaveBeenCalledExactlyOnceWith({ sheetId: 1, to: day });
  });

  it('refreshes an explicit date on visible resume before submit', () => {
    model.changeDate(new Date(2025, 11, 31));
    const now = new Date(2027, 0, 1);
    vi.setSystemTime(now);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    model.expenseModel.update((value) => ({ ...value, amount: 9, category: 'Food' }));
    model.saveExpense();
    expect(add).toHaveBeenLastCalledWith(1, expect.objectContaining({ date: now }));
    expect(model.expenseModel().date).toEqual(now);
    expect(load).toHaveBeenLastCalledWith({ sheetId: 1, to: now });
  });

  it('refreshes the untouched day and table only on visible next-day resume', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const now = new Date(2027, 0, 1, 8);
    vi.setSystemTime(now);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(load).toHaveBeenCalledTimes(1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    rows.set([{ date: now, amount: 7 }]);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(model.expenseModel().date).toEqual(now);
    expect(model.expenses()).toEqual([{ date: now, amount: 7 }]);
    expect(load).toHaveBeenLastCalledWith({ sheetId: 1, to: now });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(load).toHaveBeenCalledTimes(2);
    TestBed.resetTestingModule();
    vi.setSystemTime(new Date(2027, 0, 2));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(load).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('uses one request on open and each date/person change and none to calculate totals', () => {
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenLastCalledWith({ sheetId: 1, to: day });
    model.changeDate(new Date(2026, 10, 3));
    expect(load).toHaveBeenCalledTimes(2);
    model.changeSheet({ id: 2, title: 'B' });
    expect(model.expenseModel().sheet?.id).toBe(2);
    expect(load).toHaveBeenCalledTimes(3);
    model.summary();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('computes daily, monthly and signed Debt examples and reacts to row changes', () => {
    rows.set([{ amount: 10, date: new Date(2026, 10, 1) }, { amount: 12.3, date: day }, { amount: 5, date: day }]);
    expect(model.summary().totals).toEqual({ dailyLabel: 'Today', monthLabel: 'November', daily: '17.30', monthly: '27.30', debt: '0' });
    rows.set([{ amount: 100, date: day }, { amount: 24, date: day, isInDebt: true }]);
    expect(model.summary().totals).toMatchObject({ daily: '124.00', monthly: '124.00', debt: '24' });
    rows.set([{ amount: -2.125, date: day, isInDebt: true }]);
    expect(model.summary().totals).toMatchObject({ daily: '-2.13', monthly: '-2.13', debt: '-2.13' });
    rows.set([]);
    expect(model.summary().totals).toMatchObject({ daily: '0.00', monthly: '0.00', debt: '0' });
  });

  it('excludes invalid dates and non-finite amounts and normalizes negative zero', () => {
    rows.set([{ amount: 999 }, { amount: 999, date: new Date(NaN) }, { amount: NaN, date: day },
      { amount: Infinity, date: day }, { amount: -Infinity, date: day }, { date: day },
      { amount: -0.001, date: day, isInDebt: true }]);
    expect(model.summary().totals).toMatchObject({ daily: '0.00', monthly: '0.00', debt: '0' });
    rows.set([{ amount: Number.MAX_VALUE, date: day, isInDebt: true }, { amount: Number.MAX_VALUE, date: day, isInDebt: true }]);
    expect(model.summary().totals).toMatchObject({ daily: 'Unavailable', monthly: 'Unavailable', debt: 'Unavailable' });
  });

  it.each([new Date(2024, 1, 29), new Date(2026, 11, 31), new Date(2027, 0, 1)])('uses local midnight boundaries on %s', (date) => {
    model.changeDate(date);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    rows.set([{ amount: 1, date: start }, { amount: 2, date: new Date(end.getTime() - 1) }, { amount: 100, date: end },
      { amount: 100, date: new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, -1) }]);
    expect(model.summary().totals).toMatchObject({ dailyLabel: 'Daily', daily: '3.00', monthly: '3.00' });
  });

  it('shows a prompt when no person is selected', () => {
    model.expenseModel.update((value) => ({ ...value, sheet: null }));
    expect(model.summary()).toEqual({ placeholder: 'Select a person to view totals', totals: null });
  });

  it('keeps totals unchanged after manual and voice enqueue until loaded rows change', () => {
    rows.set([{ amount: 1, date: day }]);
    model.expenseModel.update((value) => ({ ...value, amount: 9, category: 'Food' }));
    expect(model.saveExpense()).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    expect(model.summary().totals?.daily).toBe('1.00');
    TestBed.tick();
    recording.set({ blob: new Blob(), mimeType: 'audio/webm', durationMs: 1000, recordedAt: day });
    TestBed.tick();
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(2);
    expect(model.summary().totals?.daily).toBe('1.00');
    rows.set([{ amount: 1, date: day }, { amount: 9, date: day }]);
    expect(model.summary().totals?.daily).toBe('10.00');
  });
});


describe('Dashboard queued expenses', () => {
  const day = new Date(2026, 10, 5, 12);
  let model: DashboardPageViewModel;
  let records: ReturnType<typeof signal<OutboxRecord[]>>;
  let saved: ReturnType<typeof signal<Expense[]>>;
  let spreadsheet: ReturnType<typeof signal<string | undefined>>;
  let discard: ReturnType<typeof vi.fn>;
  let remoteDelete: ReturnType<typeof vi.fn>;
  let add: ReturnType<typeof vi.fn>;
  let recording: ReturnType<typeof signal<import('src/shared/models').VoiceRecording | null>>;
  function record(id: string, expense: Expense = { date: day, amount: 10 }, overrides: Partial<OutboxRecord> = {}): OutboxRecord {
    return { localId: id, kind: 'addExpense', spreadsheetId: 'book', payload: { sheetId: 1, expense },
      enqueuedAt: 0, status: 'pending', attempts: 0, ...overrides };
  }
  beforeEach(() => {
    vi.stubGlobal('log', vi.fn());
    records = signal([]); saved = signal([]); spreadsheet = signal('book'); recording = signal(null);
    discard = vi.fn((id: string) => records.update((all) => all.filter((r) => r.localId !== id)));
    remoteDelete = vi.fn();
    add = vi.fn((sheetId: number, expense: Expense) => records.update((all) => [...all,
      record(String(all.length), expense, { payload: { sheetId, expense } })]));
    TestBed.configureTestingModule({ providers: [DashboardPageViewModel,
      { provide: Store, useValue: { selectSignal: () => spreadsheet,
        select: (selector: unknown) => of(selector === currentSheetSelector ? { id: 1, title: 'A' } : []), dispatch: vi.fn() } },
      { provide: OutboxService, useValue: { records, discard } },
      { provide: ExpensesService, useValue: { expenses: saved, load: vi.fn(), add, delete: remoteDelete } },
      { provide: VoiceRecorderService, useValue: { latest: recording } },
      { provide: ExpenseRecognitionService, useValue: { recognize: () => of([{ date: day, amount: 7 }]) } }
    ] });
    model = TestBed.inject(DashboardPageViewModel);
    model.expenseModel.update((v) => ({ ...v, date: day }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows persisted form and voice rows before saved rows without sorting expense dates', () => {
    saved.set([{ date: day, amount: 1 }, { date: day, amount: 2 }]);
    model.expenseModel.update((v) => ({ ...v, amount: 9, category: 'Food' }));
    expect(model.saveExpense()).toBe(true);
    TestBed.tick();
    recording.set({ blob: new Blob(), mimeType: 'audio/webm', durationMs: 1000, recordedAt: day });
    TestBed.tick();
    expect(model.expenses().map((r) => r.amount)).toEqual([7, 9, 1, 2]);
    expect(model.summary().totals?.daily).toBe('19.00');
    records.update((all) => all.map((r) => ({ ...r, status: 'failed' })));
    expect(model.expenses().map((r) => r.amount)).toEqual([7, 9, 1, 2]);
    expect(model.summary().totals?.daily).toBe('19.00');
  });

  it('filters restored records by reactive spreadsheet, numeric person, day and month', () => {
    records.set([
      record('start', { date: new Date(2026, 10, 5), amount: 1 }),
      record('end', { date: new Date(2026, 10, 5, 23, 59, 59, 999), amount: 2 }),
      record('earlier', { date: new Date(2026, 10, 1), amount: -4, isInDebt: true }),
      record('tomorrow', { date: new Date(2026, 10, 6), amount: 100 }),
      record('month', { date: new Date(2026, 9, 31), amount: 100 }),
      record('person', undefined, { payload: { sheetId: 2, expense: { date: day, amount: 100 } } }),
      record('book', undefined, { spreadsheetId: 'other' })
    ]);
    expect(model.expenses().map((r) => r.amount)).toEqual([2, 1]);
    expect(model.summary().totals).toMatchObject({ daily: '3.00', monthly: '-1.00', debt: '-4' });
    spreadsheet.set('other');
    expect(model.expenses().map((r) => r.amount)).toEqual([10]);
    spreadsheet.set(undefined);
    expect(model.expenses()).toEqual([]);
    spreadsheet.set('book');
    model.changeSheet({ id: 2, title: 'A' });
    expect(model.expenses().map((r) => r.amount)).toEqual([100]);
    model.expenseModel.update((v) => ({ ...v, sheet: null }));
    expect(model.expenses()).toEqual([]);
    expect(model.summary().totals).toBeNull();
  });

  it.each(['pending', 'failed'] as const)('discards one %s row locally and updates totals', (status) => {
    records.set([record('a', undefined, { status }), record('b', undefined, { status })]);
    model.deleteExpense(model.expenses()[0]);
    expect(discard).toHaveBeenCalledExactlyOnceWith('a');
    expect(records().map((r) => r.localId)).toEqual(['b']);
    expect(model.summary().totals?.daily).toBe('10.00');
    expect(remoteDelete).not.toHaveBeenCalled();
  });

  it.each([
    { date: new Date(2026, 10, 5, 13) }, { amount: 11 }, { category: 'Food' },
    { comment: 'Lunch' }, { isInDebt: true }
  ])('resolves equal timestamps using all expense fields: %s', (difference) => {
    const expense = { date: day, amount: 10, ...difference };
    records.set([record('a'), record('b', expense)]);
    model.deleteExpense(model.expenses()[0]);
    expect(discard).toHaveBeenCalledExactlyOnceWith('b');
    expect(remoteDelete).not.toHaveBeenCalled();
  });

  it('never sends a stale queued-row delete and keeps the saved-row delete path', () => {
    records.set([record('a')]);
    const queued = model.expenses()[0];
    records.set([]);
    model.deleteExpense(queued);
    expect(discard).not.toHaveBeenCalled();
    expect(remoteDelete).not.toHaveBeenCalled();
    const expense = { date: day, amount: 10 };
    model.deleteExpense(expense);
    expect(remoteDelete).toHaveBeenCalledExactlyOnceWith({ id: 1, title: 'A' }, expense);
  });

  it('shows one normal row and one total after send removal and saved-list reload', () => {
    const expense = { date: day, amount: 10, isInDebt: true };
    records.set([record('a', expense)]);
    expect(model.summary().totals?.daily).toBe('10.00');
    records.set([]);
    expect(model.expenses()).toEqual([]);
    saved.set([expense]);
    expect(model.expenses()).toEqual([expense]);
    expect(model.expenses()[0]).not.toHaveProperty('enqueuedAt');
    expect(model.summary().totals).toMatchObject({ daily: '10.00', monthly: '10.00', debt: '10' });
  });
});
