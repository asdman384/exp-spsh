import { Injectable } from '@angular/core';

import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, catchError, exhaustMap, from, map, tap, withLatestFrom } from 'rxjs';

import { Store } from '@ngrx/store';
import { CATEGORIES_SHEET_ID, SHEET_ID, SPREADSHEET_ID } from 'src/constants';
import { SpreadsheetService } from 'src/services';
import { AppActions } from './app.actions';
import { categoriesSelector, spreadsheetIdSelector } from './app.selectors';

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

  readonly loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadCategories),
      withLatestFrom(this.store.select(spreadsheetIdSelector)),
      exhaustMap(([action, id]) => this.spreadSheetService.getAllCategories(id!)),
      map((categories) => AppActions.storeCategories({ categories })),
      catchError((e) => {
        log(e);
        return EMPTY;
      })
    )
  );

  readonly addCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.adCategory),
      withLatestFrom(this.store.select(spreadsheetIdSelector)),
      exhaustMap(([action, id]) =>
        from(this.spreadSheetService.addCategory(id!, action.newCategory)).pipe(map(() => action))
      ),
      withLatestFrom(this.store.select(categoriesSelector)),
      map(([action, categories]) => AppActions.storeCategories({ categories: [...categories, action.newCategory] })),
      catchError((e) => {
        log(e);
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
