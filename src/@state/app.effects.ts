import { Injectable } from '@angular/core';

import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, catchError, exhaustMap, map, tap, withLatestFrom } from 'rxjs';

import { Store } from '@ngrx/store';
import { CATEGORIES, CATEGORIES_SHEET_ID, SHEET_ID, SPREADSHEET_ID } from 'src/constants';
import { SpreadsheetService } from 'src/services';
import { AppActions } from './app.actions';
import { categoriesSelector, categoriesSheetIdSelector, sheetIdSelector, spreadsheetIdSelector } from './app.selectors';

@Injectable()
export class AppEffects {
  readonly saveSpreadsheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.spreadsheetId),
        tap(({ spreadsheetId }) => spreadsheetId !== undefined && localStorage.setItem(SPREADSHEET_ID, spreadsheetId))
      ),
    { dispatch: false }
  );

  readonly saveSheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.sheetId),
        tap(({ sheetId }) => sheetId !== undefined && localStorage.setItem(SHEET_ID, String(sheetId)))
      ),
    { dispatch: false }
  );

  readonly saveCategoriesSheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.categoriesSheetId),
        tap(
          ({ categoriesSheetId }) =>
            categoriesSheetId !== undefined && localStorage.setItem(CATEGORIES_SHEET_ID, String(categoriesSheetId))
        )
      ),
    { dispatch: false }
  );

  readonly saveCategories$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.storeCategories),
        tap(({ categories }) => localStorage.setItem(CATEGORIES, JSON.stringify(categories)))
      ),
    { dispatch: false }
  );

  readonly loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadCategories),
      withLatestFrom(this.store.select(spreadsheetIdSelector)),
      tap(() => this.store.dispatch(AppActions.loading({ loading: true }))),
      exhaustMap(([action, id]) => this.spreadSheetService.getAllCategories(id!)),
      map((categories) => AppActions.storeCategories({ categories })),
      tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
      catchError((e) => {
        this.store.dispatch(AppActions.loading({ loading: false }));
        log(e);
        return EMPTY;
      })
    )
  );

  readonly addCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.addCategory),
      withLatestFrom(this.store.select(spreadsheetIdSelector)),
      tap(() => this.store.dispatch(AppActions.loading({ loading: true }))),
      exhaustMap(([{ newCategory }, id]) =>
        this.spreadSheetService.addCategory(id!, newCategory).then(() => newCategory)
      ),
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
      withLatestFrom(
        this.store.select(spreadsheetIdSelector),
        this.store.select(categoriesSheetIdSelector),
        this.store.select(categoriesSelector)
      ),
      exhaustMap(([action, spreadsheetId, sheetId, categories]) => {
        this.store.dispatch(AppActions.loading({ loading: true }));
        const index = categories.findIndex((c) => c.name === action.category.name);
        if (!~index) {
          throw `cannot find category [${action.category.name}]`;
        }
        const newCategories = [...categories];
        newCategories.splice(index, 1);
        return this.spreadSheetService.deleteCategory(spreadsheetId!, sheetId!, index).then(() => newCategories);
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
      withLatestFrom(this.store.select(spreadsheetIdSelector), this.store.select(categoriesSelector)),
      exhaustMap(([action, id, categoriesBackUp]) => {
        this.categoriesBackUp = categoriesBackUp;
        this.store.dispatch(AppActions.loading({ loading: true }));
        this.store.dispatch(AppActions.storeCategories({ categories: action.categories }));
        return this.spreadSheetService.updateCategories(id!, action.categories);
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
      tap(() => this.store.dispatch(AppActions.loading({ loading: true }))),
      withLatestFrom(this.store.select(spreadsheetIdSelector), this.store.select(sheetIdSelector)),
      exhaustMap(([{ expense }, spreadsheetId, sheetId]) =>
        this.spreadSheetService.addExpense(spreadsheetId!, sheetId!, expense).then(() => expense)
      ),
      map(() => AppActions.loading({ loading: false })),
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
    private readonly spreadSheetService: SpreadsheetService
  ) {}
}
