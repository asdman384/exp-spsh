import { Injectable } from '@angular/core';

import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, catchError, exhaustMap, map, of, tap } from 'rxjs';

import { CATEGORIES_SHEET_ID, SHEET_ID, SPREADSHEET_ID } from 'src/constants';
import { AppActions } from './app.actions';
import { SpreadsheetService } from 'src/services';

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
      exhaustMap(() =>
        this.spreadSheetService.getAllCategories().pipe(
          map((categories) => AppActions.storeCategories({ categories })),
          catchError(() => EMPTY)
        )
      )
    )
  );

  constructor(private readonly actions$: Actions, private readonly spreadSheetService: SpreadsheetService) {}
}
