import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import {
  EMPTY,
  catchError,
  filter,
  finalize,
  first,
  retry,
  skip,
  switchMap,
  tap,
  throwError,
  timer,
  withLatestFrom
} from 'rxjs';

import { AppActions, categoriesSelector, currentSheetSelector, loadingSelector, sheetsSelector } from 'src/@state';
import { ExpenseRecognitionService, VoiceRecorderService } from 'src/services';
import { Expense, Sheet, VoiceRecording } from 'src/shared/models';
import { ExpensesService } from '../expenses.service';

/** How many times a retryable recognition failure is retried before the failure toast. */
const RECOGNITION_MAX_RETRIES = 2;
/** Base back-off; attempt N waits N × this. */
const RECOGNITION_RETRY_DELAY_MS = 1000;

/**
 * Decides whether a Gemini recognition failure is worth retrying.
 * TODO: narrow to the specific error type — until then nothing is retried.
 */
function isRetryableRecognitionError(error: unknown): boolean {
  return error instanceof Error && false;
}

interface ExpenseFormModel {
  date: Date;
  sheet: Sheet | null;
  amount: number | null;
  category: string | null;
  comment: string;
  isInDebt: boolean;
}

@Injectable()
export class DashboardPageViewModel {
  private readonly store = inject(Store);
  readonly loading$ = this.store.select(loadingSelector);
  readonly sheets$ = this.store.select(sheetsSelector);
  readonly categories$ = this.store.select(categoriesSelector);

  private readonly expensesService = inject(ExpensesService);
  readonly expenses = computed(() => {
    const date = this.expenseModel().date;
    const from = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const to = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return this.expensesService.expenses().filter((expense) =>
      expense.date && expense.date >= from && expense.date < to
    );
  });
  private readonly recorder = inject(VoiceRecorderService);
  private readonly recognition = inject(ExpenseRecognitionService);

  readonly expenseModel = signal<ExpenseFormModel>(this.createExpenseModel());

  readonly summary = computed(() => {
    const { date, sheet } = this.expenseModel();
    if (!sheet) return { placeholder: 'Select a person to view totals', totals: null };
    const from = new Date(date.getFullYear(), date.getMonth(), 1);
    const to = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const monthly = this.expensesService.expenses().filter((row) => row.date && row.date >= from && row.date < to);
    return {
      placeholder: '',
      totals: {
        dailyLabel: date.toDateString() === new Date().toDateString() ? 'Today' : 'Daily',
        monthLabel: date.toLocaleString('en-US', { month: 'long' }),
        daily: formatTotal(this.expenses(), 2),
        monthly: formatTotal(monthly, 2),
        debt: formatTotal(monthly.filter((row) => row.isInDebt), 0)
      }
    };
  });

  constructor() {
    this.store
      .select(currentSheetSelector)
      .pipe(
        first(),
        tap((sheet) => {
          this.expenseModel.update((model) => ({ ...model, sheet: sheet ?? null }));
          if (sheet) {
            this.expensesService.load({ sheetId: sheet.id, to: this.expenseModel().date });
          }
        })
      )
      .subscribe();

    this.recognizeExpenses();
  }

  saveExpense(): boolean {
    const value = this.expenseModel();
    if (value.sheet === null || value.amount === null || value.category === null) {
      return false;
    }
    log('DashboardPageContainer::onSubmit', value);
    this.expensesService.add(value.sheet.id, { ...value, amount: value.amount, category: value.category });
    this.expenseModel.set({ ...this.createExpenseModel(), date: value.date, sheet: value.sheet });
    return true;
  }

  changeSheet(sheet: Sheet): void {
    log('DashboardPageContainer::onSheetChange', sheet);
    this.expenseModel.update((model) => ({ ...model, sheet }));
    this.expensesService.load({ sheetId: sheet.id, to: this.expenseModel().date });
  }

  changeDate(date: Date): void {
    log('DashboardPageContainer::onDateChange', date);
    const currentTime = new Date(date);
    currentTime.setHours(new Date().getHours(), new Date().getMinutes());
    this.expenseModel.update((model) => ({ ...model, date: currentTime }));
    const sheet = this.expenseModel().sheet;
    if (sheet) this.expensesService.load({ sheetId: sheet.id, to: currentTime });
  }

  loadCategories(): void {
    this.store.dispatch(AppActions.loadCategories());
  }

  clearComment(): void {
    this.expenseModel.update((model) => ({ ...model, comment: '' }));
  }

  deleteExpense(expense: Expense): void {
    const sheet = this.expenseModel().sheet;
    if (!sheet) {
      return;
    }

    this.expensesService.delete(sheet, expense);
  }

  /** Recognizes each new voice note and queues its expenses for the selected sheet. */
  private recognizeExpenses(): void {
    toObservable(this.recorder.latest)
      .pipe(
        // The first emission is whatever recording was already held when the page opened.
        skip(1),
        filter((recording): recording is VoiceRecording => recording !== null),
        withLatestFrom(this.categories$),
        switchMap(([recording, categories]) => {
          this.store.dispatch(AppActions.loading({ loading: true }));
          return this.recognition.recognize(recording, categories.map((c) => c.name), new Date()).pipe(
            retry({
              count: RECOGNITION_MAX_RETRIES,
              delay: (error, retryCount) => {
                if (!isRetryableRecognitionError(error)) {
                  return throwError(() => error);
                }
                log(`DashboardPageContainer::recognize retry ${retryCount}/${RECOGNITION_MAX_RETRIES}`, error);

                return timer(RECOGNITION_RETRY_DELAY_MS * retryCount);
              }
            }),
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

function formatTotal(rows: Expense[], minimumFractionDigits: number): string {
  const total = rows.reduce((sum, row) => sum + (typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : 0), 0);
  if (!Number.isFinite(total)) return 'Unavailable';
  const formatted = total.toLocaleString('en-US', { useGrouping: false, minimumFractionDigits, maximumFractionDigits: 2 });
  return Number(formatted) === 0 ? formatted.replace('-', '') : formatted;
}
