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
