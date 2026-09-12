import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MAT_NATIVE_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import { first, tap } from 'rxjs';

import {
  AppActions,
  categoriesSelector,
  currentSheetSelector,
  expensesSelector,
  loadingSelector,
  sheetsSelector
} from 'src/@state';
import { TIME_FORMAT } from 'src/constants';
import { Expense, Sheet } from 'src/shared/models';
import { ExpensesTableComponent } from 'src/shared/components';

interface ExpenseFormModel {
  date: Date;
  sheet: Sheet | null;
  amount: number | null;
  category: string | null;
  comment: string;
  isInDebt: boolean;
}

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.container.html',
  styleUrl: './dashboard-page.container.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    AsyncPipe,
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    ExpensesTableComponent
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    {
      provide: MAT_DATE_FORMATS,
      useValue: {
        ...MAT_NATIVE_DATE_FORMATS,
        display: {
          ...MAT_NATIVE_DATE_FORMATS.display,
          dateInput: {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          } as Intl.DateTimeFormatOptions
        }
      }
    }
  ]
})
export class DashboardPageContainer {
  protected readonly loading$ = this.store.select(loadingSelector);
  protected readonly sheets$ = this.store.select(sheetsSelector);
  protected readonly categories$ = this.store.select(categoriesSelector);
  protected readonly expenses$ = this.store.select(expensesSelector);
  protected readonly timeFormat = TIME_FORMAT;

  protected minDate: Date = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0);

  protected readonly expenseModel = signal<ExpenseFormModel>(this.createExpenseModel());
  protected readonly expenseForm = form(this.expenseModel, (p) => {
    required(p.date);
    required(p.sheet);
    required(p.amount);
    required(p.category);
  });

  constructor(private readonly store: Store) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard', icon: 'dashboard' }));
    this.store
      .select(currentSheetSelector)
      .pipe(
        first(),
        tap((sheet) => {
          if (sheet) {
            this.store.dispatch(AppActions.loadExpenses({ sheetId: sheet.id }));
          }
        })
      )
      .subscribe((sheet) => this.expenseModel.update((model) => ({ ...model, sheet: sheet ?? null })));
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.expenseForm().valid()) {
      return;
    }
    const value = this.expenseForm().value();
    log('DashboardPageContainer::onSubmit', value);
    const sheet = value.sheet as Sheet;
    this.store.dispatch(AppActions.addExpense({ expense: value as Expense, sheetId: sheet.id }));
    this.expenseForm().reset({
      ...this.createExpenseModel(),
      date: value.date,
      sheet
    });
  }

  protected onSheetChange(sheet: Sheet): void {
    log('DashboardPageContainer::onSheetChange', sheet);
    this.store.dispatch(AppActions.loadExpenses({ sheetId: sheet.id, ...this.getInterval(this.expenseModel().date) }));
  }

  protected onDateChange(date: Date): void {
    log('DashboardPageContainer::onDateChange', date);
    const sheet = this.expenseModel().sheet;
    if (!sheet) {
      return;
    }

    this.store.dispatch(AppActions.loadExpenses({ sheetId: sheet.id, ...this.getInterval(date) }));

    const currentTime = new Date(date);
    currentTime.setHours(new Date().getHours(), new Date().getMinutes());
    this.expenseModel.update((model) => ({ ...model, date: currentTime }));
  }

  protected loadCategories(): void {
    this.store.dispatch(AppActions.loadCategories());
  }

  protected clearComment(): void {
    this.expenseModel.update((model) => ({ ...model, comment: '' }));
  }

  protected handleDeleteExpense(expense: Expense): void {
    const sheet = this.expenseModel().sheet;
    if (!sheet) {
      return;
    }

    this.store.dispatch(AppActions.deleteExpense({ expense, sheet }));
  }

  private getInterval(from: Date): { from: Date; to?: Date } {
    const currentMonth = new Date().getMonth();
    const currentDay = new Date().getDate();

    if (from.getMonth() === currentMonth && from.getDate() === currentDay) {
      return { from };
    }

    const to = new Date(from);
    to.setDate(to.getDate() + 1); // add a day
    return { from, to };
  }

  private createExpenseModel(): ExpenseFormModel {
    return {
      date: new Date(),
      sheet: null,
      amount: null,
      category: null,
      comment: '',
      isInDebt: false
    };
  }
}
