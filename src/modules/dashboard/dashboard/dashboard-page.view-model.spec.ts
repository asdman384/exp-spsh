import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { currentSheetSelector } from 'src/@state';
import { ExpenseRecognitionService, VoiceRecorderService } from 'src/services';
import { Expense } from 'src/shared/models';
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
        { provide: Store, useValue: {
          select: (selector: unknown) => of(selector === currentSheetSelector ? undefined : []),
          dispatch: vi.fn()
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
      { provide: Store, useValue: { select: (selector: unknown) => of(selector === currentSheetSelector ? { id: 1, title: 'A' } : []), dispatch: vi.fn() } },
      { provide: ExpensesService, useValue: { expenses: rows, load, add } },
      { provide: VoiceRecorderService, useValue: { latest: recording } },
      { provide: ExpenseRecognitionService, useValue: { recognize } }
    ] });
    model = TestBed.inject(DashboardPageViewModel);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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
