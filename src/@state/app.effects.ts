import { Injectable } from '@angular/core';

import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, Observable, catchError, exhaustMap, filter, map, of, switchMap, tap, withLatestFrom } from 'rxjs';

import { Store } from '@ngrx/store';
import { CATEGORIES, CATEGORIES_SHEET_ID, DATA_SHEETS, SPREADSHEET_ID } from 'src/constants';
import { LocalStorageService, NetworkStatusService, SpreadsheetService } from 'src/services';
import { isExpenseEqual } from 'src/shared/helpers';
import { AppActions } from './app.actions';
import { categoriesSelector, categoriesSheetIdSelector, expensesSelector, sheetsSelector } from './app.selectors';

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
        tap(({ spreadsheetId }) => spreadsheetId && LocalStorageService.put(SPREADSHEET_ID, spreadsheetId))
      ),
    { dispatch: false }
  );

  readonly saveSheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.upsertDataSheet),
        tap(log),
        switchMap(() => this.store.select(sheetsSelector)),
        tap((sheets) => LocalStorageService.put(DATA_SHEETS, sheets))
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
        )
      ),
    { dispatch: false }
  );

  readonly saveCategories$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.storeCategories),
        tap(log),
        tap(({ categories }) => LocalStorageService.put(CATEGORIES, categories))
      ),
    { dispatch: false }
  );

  readonly loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadCategories),
      tap<ReturnType<typeof AppActions.loadCategories>>(log),
      tap(() => this.store.dispatch(AppActions.loading({ loading: true }))),
      exhaustMap(() => this.spreadSheetService.getAllCategories()),
      map((categories) => AppActions.storeCategories({ categories })),
      tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
      catchError((e) => {
        log(e);
        this.store.dispatch(AppActions.loading({ loading: false }));
        return EMPTY;
      })
    )
  );

  readonly addCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.addCategory),
      tap<ReturnType<typeof AppActions.addCategory>>(log),
      exhaustMap(({ newCategory }) => {
        this.store.dispatch(AppActions.loading({ loading: true }));
        return this.spreadSheetService.addCategory(newCategory).pipe(map(() => newCategory));
      }),
      withLatestFrom(this.store.select(categoriesSelector)),
      map(([newCategory, categories]) => AppActions.storeCategories({ categories: [...categories, newCategory] })),
      tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
      catchError((e) => {
        log(e);
        this.store.dispatch(AppActions.loading({ loading: false }));
        return EMPTY;
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
        if (!~index) {
          throw `cannot find category [${action.category.name}]`;
        }
        const newCategories = [...categories];
        newCategories.splice(index, 1);
        return this.spreadSheetService.deleteSheetRow(sheetId!, index).pipe(map(() => newCategories));
      }),
      map((categories) => AppActions.storeCategories({ categories })),
      tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
      catchError((e) => {
        log(e);
        this.store.dispatch(AppActions.loading({ loading: false }));
        return EMPTY;
      })
    )
  );

  private categoriesBackUp: any;
  readonly updateCategoryPosition$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.updateCategoryPosition),
      tap<ReturnType<typeof AppActions.updateCategoryPosition>>(log),
      withLatestFrom(this.store.select(categoriesSelector)),
      exhaustMap(([action, categoriesBackUp]) => {
        this.categoriesBackUp = categoriesBackUp;
        this.store.dispatch(AppActions.loading({ loading: true }));
        this.store.dispatch(AppActions.storeCategories({ categories: action.categories }));
        return this.spreadSheetService.updateCategories(action.categories);
      }),
      map(() => AppActions.loading({ loading: false })),
      catchError((e) => {
        log(e);
        AppActions.storeCategories({ categories: this.categoriesBackUp });
        this.store.dispatch(AppActions.loading({ loading: false }));
        return EMPTY;
      })
    )
  );

  readonly addExpense$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.addExpense),
      tap<ReturnType<typeof AppActions.addExpense>>(log),
      exhaustMap((action) => {
        this.store.dispatch(AppActions.loading({ loading: true }));
        return this.spreadSheetService.addExpense(action.sheetId, action.expense).pipe(map(() => action));
      }),
      map((action) => {
        const to = new Date(action.expense.date!);
        to.setDate(to.getDate() + 1); // add a day
        return AppActions.loadExpenses({ sheetId: action.sheetId, from: action.expense.date, to });
      }),
      catchError((e) => {
        log(e);
        this.store.dispatch(AppActions.loading({ loading: false }));
        return EMPTY;
      })
    )
  );

  readonly deleteExpense$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.deleteExpense),
      tap<ReturnType<typeof AppActions.deleteExpense>>(log),
      exhaustMap((action) => {
        this.store.dispatch(AppActions.loading({ loading: true }));
        return this.spreadSheetService
          .loadLastExpenses(action.sheet.title, 100)
          .pipe(map((expenses) => ({ action, expenses })));
      }),
      withLatestFrom(this.store.select(expensesSelector)),
      exhaustMap(([{ action, expenses }, oldExpenses]) => {
        const i = expenses.findIndex((e) => isExpenseEqual(e, action.expense));
        if (!~i) {
          return of([...oldExpenses]);
        }
        return this.spreadSheetService.deleteSheetRow(action.sheet.id, i).pipe(
          map(() => {
            const i = oldExpenses.findIndex((e) => isExpenseEqual(e, action.expense));
            const newExpenses = [...oldExpenses];
            newExpenses.splice(i, 1);
            return newExpenses;
          })
        );
      }),
      map((expenses) => {
        this.store.dispatch(AppActions.loading({ loading: false }));
        return AppActions.storeExpenses({ expenses });
      }),
      catchError((e) => {
        log(e);
        this.store.dispatch(AppActions.loading({ loading: false }));
        return EMPTY;
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
        return this.spreadSheetService.loadExpenses(action);
      }),
      map((expenses) => AppActions.storeExpenses({ expenses })),
      tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
      catchError((e) => {
        log(e);
        this.store.dispatch(AppActions.loading({ loading: false }));
        return EMPTY;
      })
    )
  );

  constructor(
    private readonly store: Store,
    private readonly actions$: Actions,
    private readonly status: NetworkStatusService,
    private readonly spreadSheetService: SpreadsheetService
  ) {}
}
