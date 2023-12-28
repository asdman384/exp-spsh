import { Injectable } from '@angular/core';

import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs';

import { SPREADSHEET_ID } from 'src/constants';
import { AppActions } from './app.actions';

@Injectable()
export class AppEffects {
  saveSpreadsheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.spreadsheetId),
        tap((props) => localStorage.setItem(SPREADSHEET_ID, props.spreadsheetId))
      ),
    { dispatch: false }
  );

  constructor(private actions$: Actions) {}
}
