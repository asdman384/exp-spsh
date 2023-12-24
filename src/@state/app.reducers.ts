import { isDevMode } from '@angular/core';

import { ActionReducerMap, MetaReducer, createReducer, on } from '@ngrx/store';

import { AppActions } from './app.actions';
import { AppState } from './app.model';

export const initialState: AppState = { title: '' };

export const reducers: ActionReducerMap<{ app: AppState }> = {
  app: createReducer(
    initialState,
    on(AppActions.setTitle, (state, { title }) => ({ ...state, title }))
  )
};

export const metaReducers: MetaReducer<{ app: AppState }>[] = isDevMode() ? [] : [];
