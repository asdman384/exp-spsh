import { Injectable } from '@angular/core';

import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  EMPTY,
  Observable,
  catchError,
  combineLatest,
  exhaustMap,
  filter,
  map,
  of,
  switchMap,
  take,
  tap,
  throwError,
  withLatestFrom
} from 'rxjs';

import { Store } from '@ngrx/store';
import { CATEGORIES, CATEGORIES_SHEET_ID, DATA_SHEETS, SPREADSHEET_ID } from 'src/constants';
import { LocalStorageService, NetworkStatusService, OutboxStorage, SpreadsheetService } from 'src/services';
import { Memento, classifyWriteError, isExpenseEqual, toMessage } from 'src/shared/helpers';
import { Category, Expense, OutboxRecord } from 'src/shared/models';
import { AppActions } from './app.actions';
import { categoriesSelector, categoriesSheetIdSelector, expensesSelector, sheetsSelector } from './app.selectors';
import { OutboxActions } from './outbox.actions';
import { pendingCountSelector } from './outbox.selectors';
import { FAILURE_MESSAGES, reportFailure } from './report-failure';

@Injectable()
export class AppEffects {
  private readonly whenOnline = <T>(arg: T): Observable<T> =>
    this.status.online$.pipe(
      filter(Boolean),
      map(() => arg)
    );

  readonly saveSpreadsheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.spreadsheetId),
        tap(log),
        tap(({ spreadsheetId }) => spreadsheetId && LocalStorageService.put(SPREADSHEET_ID, spreadsheetId)),
        catchError((e) => {
          log(e);
          return EMPTY;
        })
      ),
    { dispatch: false }
  );

  readonly saveSheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.upsertDataSheet),
        tap(log),
        switchMap(() => this.store.select(sheetsSelector)),
        tap((sheets) => LocalStorageService.put(DATA_SHEETS, sheets)),
        catchError((e) => {
          log(e);
          return EMPTY;
        })
      ),
    { dispatch: false }
  );

  readonly saveCategoriesSheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.categoriesSheetId),
        tap(log),
        tap(
          ({ categoriesSheetId }) =>
            categoriesSheetId !== undefined && LocalStorageService.put(CATEGORIES_SHEET_ID, categoriesSheetId)
        ),
        catchError((e) => {
          log(e);
          return EMPTY;
        })
      ),
    { dispatch: false }
  );

  readonly saveCategories$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.storeCategories),
        tap(log),
        tap(({ categories }) => LocalStorageService.put(CATEGORIES, categories)),
        catchError((e) => {
          log(e);
          return EMPTY;
        })
      ),
    { dispatch: false }
  );

  readonly loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadCategories),
      tap<ReturnType<typeof AppActions.loadCategories>>(log),
      tap(() => this.store.dispatch(AppActions.loading({ loading: true }))),
      exhaustMap(() =>
        this.spreadSheetService.getAllCategories().pipe(
          map((categories) => AppActions.storeCategories({ categories })),
          tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
          catchError(reportFailure('loadCategories$', this.store))
        )
      )
    )
  );

  readonly addCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.addCategory),
      tap<ReturnType<typeof AppActions.addCategory>>(log),
      exhaustMap(({ newCategory }) => {
        this.store.dispatch(AppActions.loading({ loading: true }));
        return this.spreadSheetService.addCategory(newCategory).pipe(
          withLatestFrom(this.store.select(categoriesSelector)),
          map(([, categories]) => AppActions.storeCategories({ categories: [...categories, newCategory] })),
          tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
          catchError(reportFailure('addCategory$', this.store))
        );
      })
    )
  );

  readonly deleteCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.deleteCategory),
      tap<ReturnType<typeof AppActions.deleteCategory>>(log),
      withLatestFrom(this.store.select(categoriesSheetIdSelector), this.store.select(categoriesSelector)),
      exhaustMap(([action, sheetId, categories]) => {
        this.store.dispatch(AppActions.loading({ loading: true }));
        const index = categories.findIndex((c) => c.name === action.category.name);
        const deletion$ = !~index
          ? throwError(() => `cannot find category [${action.category.name}]`)
          : (() => {
              const newCategories = [...categories];
              newCategories.splice(index, 1);
              return this.spreadSheetService.deleteSheetRow(sheetId!, index).pipe(map(() => newCategories));
            })();
        return deletion$.pipe(
          map((newCategories) => AppActions.storeCategories({ categories: newCategories })),
          tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
          catchError(reportFailure('deleteCategory$', this.store))
        );
      })
    )
  );

  private readonly categoriesMemento = new Memento<Category[]>();
  readonly updateCategoryPosition$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.updateCategoryPosition),
      tap<ReturnType<typeof AppActions.updateCategoryPosition>>(log),
      withLatestFrom(this.store.select(categoriesSelector)),
      exhaustMap(([action, categoriesBackUp]) => {
        this.categoriesMemento.save(categoriesBackUp);
        this.store.dispatch(AppActions.loading({ loading: true }));
        this.store.dispatch(AppActions.storeCategories({ categories: action.categories }));
        return this.spreadSheetService.updateCategories(action.categories).pipe(
          map(() => AppActions.loading({ loading: false })),
          catchError((e) => {
            log(e);
            this.store.dispatch(AppActions.storeCategories({ categories: this.categoriesMemento.take() ?? [] }));
            this.store.dispatch(AppActions.loading({ loading: false }));
            this.store.dispatch(
              AppActions.operationFailed({
                source: 'updateCategoryPosition$',
                message: FAILURE_MESSAGES.updateCategoryPosition$
              })
            );
            return EMPTY;
          })
        );
      })
    )
  );

  readonly addExpense$ = createEffect(() => {
    // Kept local to this effect's body per docs/specs/write-outbox.md D15/[AC18]: no new class
    // members, no new field-initialiser `select`.
    const buildRecord = (
      action: ReturnType<typeof AppActions.addExpense>,
      attempts: number,
      identity: { spreadsheetId: string; enqueuedAt: number } = {
        spreadsheetId: this.spreadSheetService.getSpreadsheetId(),
        enqueuedAt: Date.now()
      },
      lastError?: string
    ): OutboxRecord => {
      const { date, amount, category, comment, isInDebt } = action.expense;
      return {
        localId: crypto.randomUUID(),
        kind: 'addExpense',
        spreadsheetId: identity.spreadsheetId,
        payload: { sheetId: action.sheetId, expense: { date, amount, category, comment, isInDebt } },
        enqueuedAt: identity.enqueuedAt,
        status: 'pending',
        attempts,
        lastError
      };
    };

    const sendLive$ = (
      action: ReturnType<typeof AppActions.addExpense>,
      queueOnFailure: boolean
    ): Observable<ReturnType<typeof AppActions.loadExpenses> | ReturnType<typeof OutboxActions.enqueue>> => {
      // D2/[AC16]: capture the routing-time identity before the request goes out, so a
      // spreadsheet switch while the request is in flight can't re-target a queued record.
      const identity = { spreadsheetId: this.spreadSheetService.getSpreadsheetId(), enqueuedAt: Date.now() };
      this.store.dispatch(AppActions.loading({ loading: true }));
      return this.spreadSheetService.addExpense(action.sheetId, action.expense).pipe(
        map(() => {
          const to = new Date(action.expense.date!);
          to.setDate(to.getDate() + 1); // add a day
          return AppActions.loadExpenses({ sheetId: action.sheetId, from: action.expense.date, to });
        }),
        catchError((e) => {
          if (!queueOnFailure || classifyWriteError(e) === 'terminal') {
            return reportFailure('addExpense$', this.store)(e);
          }
          this.store.dispatch(AppActions.loading({ loading: false }));
          return of(OutboxActions.enqueue({ record: buildRecord(action, 1, identity, toMessage(e)), drain: false }));
        })
      );
    };

    return this.actions$.pipe(
      ofType(AppActions.addExpense),
      tap<ReturnType<typeof AppActions.addExpense>>(log),
      exhaustMap((action) => {
        const usable = this.outboxStorage.isAvailable() && this.spreadSheetService.getSpreadsheetId() !== '';
        if (!usable) {
          return sendLive$(action, false);
        }
        return combineLatest([
          this.status.online$.pipe(take(1)),
          this.store.select(pendingCountSelector).pipe(take(1))
        ]).pipe(
          switchMap(([online, pending]) => {
            if (!online) {
              return of(OutboxActions.enqueue({ record: buildRecord(action, 0), drain: false }));
            }
            if (pending > 0) {
              return of(OutboxActions.enqueue({ record: buildRecord(action, 0), drain: true }));
            }
            return sendLive$(action, true);
          })
        );
      })
    );
  });

  private readonly deletedExpenseMemento = new Memento<{ expense: Expense; index: number }>();
  readonly deleteExpense$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.deleteExpense),
      tap<ReturnType<typeof AppActions.deleteExpense>>(log),
      withLatestFrom(this.store.select(expensesSelector)),
      exhaustMap(([action, oldExpenses]) => {
        const index = oldExpenses.findIndex((e) => isExpenseEqual(e, action.expense));
        if (~index) {
          this.deletedExpenseMemento.save({ expense: oldExpenses[index], index });
          const newExpenses = [...oldExpenses];
          newExpenses.splice(index, 1);
          this.store.dispatch(AppActions.storeExpenses({ expenses: newExpenses }));
        } else {
          this.deletedExpenseMemento.clear();
        }

        this.store.dispatch(AppActions.loading({ loading: true }));
        return this.spreadSheetService.loadLastExpenses(action.sheet.title, 100).pipe(
          switchMap((expenses) => {
            const i = expenses.findIndex((e) => isExpenseEqual(e, action.expense));
            if (!~i) {
              throw `cannot find expense in the last 100 rows`;
            }
            return this.spreadSheetService.deleteSheetRow(action.sheet.id, i);
          }),
          map(() => {
            this.deletedExpenseMemento.clear();
            return AppActions.loading({ loading: false });
          }),
          catchError((e) => {
            log(e);
            const backup = this.deletedExpenseMemento.take();
            if (!backup) {
              this.store.dispatch(AppActions.loading({ loading: false }));
              this.store.dispatch(
                AppActions.operationFailed({ source: 'deleteExpense$', message: FAILURE_MESSAGES.deleteExpense$ })
              );
              return EMPTY;
            }
            return this.store.select(expensesSelector).pipe(
              take(1),
              map((currentExpenses) => {
                const idx = currentExpenses.findIndex((e) => isExpenseEqual(e, backup.expense));
                const restored = [...currentExpenses];
                if (!~idx) {
                  const insertAt = Math.min(backup.index, restored.length);
                  restored.splice(insertAt, 0, backup.expense);
                }
                return restored;
              }),
              tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
              tap(() =>
                this.store.dispatch(
                  AppActions.operationFailed({ source: 'deleteExpense$', message: FAILURE_MESSAGES.deleteExpense$ })
                )
              ),
              map((expenses) => AppActions.storeExpenses({ expenses }))
            );
          })
        );
      })
    )
  );

  readonly loadExpenses$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadExpenses),
      tap<ReturnType<typeof AppActions.loadExpenses>>(log),
      switchMap(this.whenOnline),
      exhaustMap((action) => {
        this.store.dispatch(AppActions.loading({ loading: true }));
        return this.spreadSheetService.loadExpenses(action).pipe(
          map((expenses) => AppActions.storeExpenses({ expenses })),
          tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
          catchError(reportFailure('loadExpenses$', this.store))
        );
      })
    )
  );

  readonly showFailureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.operationFailed),
        tap(({ message }) =>
          this.snackBar.open(message, 'Dismiss', { politeness: 'assertive', verticalPosition: 'top' })
        )
      ),
    { dispatch: false }
  );

  constructor(
    private readonly store: Store,
    private readonly actions$: Actions,
    private readonly status: NetworkStatusService,
    private readonly spreadSheetService: SpreadsheetService,
    private readonly snackBar: MatSnackBar,
    private readonly outboxStorage: OutboxStorage
  ) {}
}
