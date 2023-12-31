import { Injectable } from '@angular/core';

import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs';

import { SHEET_ID, SPREADSHEET_ID } from 'src/constants';
import { AppActions } from './app.actions';

@Injectable()
export class AppEffects {
  readonly saveSpreadsheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.spreadsheetId),
        tap((props) => props.spreadsheetId !== undefined && localStorage.setItem(SPREADSHEET_ID, props.spreadsheetId))
      ),
    { dispatch: false }
  );

  readonly saveSheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.sheetId),
        tap((props) => props.sheetId !== undefined && localStorage.setItem(SHEET_ID, String(props.sheetId)))
      ),
    { dispatch: false }
  );

  constructor(private actions$: Actions) {}
}