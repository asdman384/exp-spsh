import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
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
import { EMPTY, catchError, filter, finalize, first, skip, switchMap, tap, withLatestFrom } from 'rxjs';

import { AppActions, categoriesSelector, currentSheetSelector, loadingSelector, sheetsSelector } from 'src/@state';
import { TIME_FORMAT } from 'src/constants';
import { ExpenseRecognitionService, VoiceRecorderService } from 'src/services';
import { Expense, Sheet, VoiceRecording } from 'src/shared/models';
import { ExpensesTableComponent } from 'src/shared/components';
import { VoiceRecordButtonComponent } from 'src/shared/components/voice-record-button/voice-record-button.component';
import { ExpensesService } from '../expenses.service';

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
    ExpensesTableComponent,
    VoiceRecordButtonComponent
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
  protected readonly timeFormat = TIME_FORMAT;

  private readonly expensesService = inject(ExpensesService);
  protected readonly expenses = this.expensesService.expenses;
  private readonly recorder = inject(VoiceRecorderService);
  private readonly recognition = inject(ExpenseRecognitionService);

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
            this.expensesService.load({ sheetId: sheet.id });
          }
        })
      )
      .subscribe((sheet) => this.expenseModel.update((model) => ({ ...model, sheet: sheet ?? null })));

    this.logRecognizedExpenses();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.expenseForm().valid()) {
      return;
    }
    const value = this.expenseForm().value();
    log('DashboardPageContainer::onSubmit', value);
    const sheet = value.sheet as Sheet;
    this.expensesService.add(sheet.id, value as Expense);
    this.expenseForm().reset({
      ...this.createExpenseModel(),
      date: value.date,
      sheet
    });
  }

  protected onSheetChange(sheet: Sheet): void {
    log('DashboardPageContainer::onSheetChange', sheet);
    this.expensesService.load({ sheetId: sheet.id, ...this.getInterval(this.expenseModel().date) });
  }

  protected onDateChange(date: Date): void {
    log('DashboardPageContainer::onDateChange', date);
    const sheet = this.expenseModel().sheet;
    if (!sheet) {
      return;
    }

    this.expensesService.load({ sheetId: sheet.id, ...this.getInterval(date) });

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

    this.expensesService.delete(sheet, expense);
  }

  /**
   * Sends every new voice note to Gemini and logs the recognized expenses as JSON. Nothing is
   * dispatched yet: the result is only for inspection in the console / log overlay.
   */
  private logRecognizedExpenses(): void {
    toObservable(this.recorder.latest)
      .pipe(
        // The first emission is whatever recording was already held when the page opened.
        skip(1),
        filter((recording): recording is VoiceRecording => recording !== null),
        withLatestFrom(this.categories$),
        switchMap(([recording, categories]) => {
          this.store.dispatch(AppActions.loading({ loading: true }));
          return this.recognition.recognize(recording, categories.map((c) => c.name), new Date()).pipe(
            catchError((error) => {
              log('DashboardPageContainer::recognize failed', error);
              this.store.dispatch(AppActions.operationFailed({ source: 'Gemini', message: error }));

              return EMPTY;
            }),
            finalize(() => this.store.dispatch(AppActions.loading({ loading: false })))
          )
        }
        ),
        takeUntilDestroyed()
      )
      .subscribe((expenses) => {
        log('DashboardPageContainer::recognized expenses', JSON.stringify(expenses, null, 2));
        console.log('Recognized expenses:', expenses);
        const sheet = this.expenseModel().sheet;
        expenses.forEach((expense) => this.expensesService.add(sheet!.id, expense));
      });
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
