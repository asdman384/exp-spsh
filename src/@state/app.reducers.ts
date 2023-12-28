import { isDevMode } from '@angular/core';

import { ActionReducerMap, MetaReducer, createReducer, on } from '@ngrx/store';

import { SPREADSHEET_ID } from 'src/constants';
import { AppActions } from './app.actions';
import { AppState } from './app.model';

export const initialState: AppState = {
  title: '',
  spreadsheetId: localStorage.getItem(SPREADSHEET_ID)
};

export const reducers: ActionReducerMap<{ app: AppState }> = {
  app: createReducer(
    initialState,
    on(AppActions.setTitle, (state, { title }) => ({ ...state, title })),
    on(AppActions.spreadsheetId, (state, { spreadsheetId }) => ({ ...state, spreadsheetId }))
  )
};

export const metaReducers: MetaReducer<{ app: AppState }>[] = isDevMode() ? [] : [];
