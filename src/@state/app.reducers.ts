import { isDevMode } from '@angular/core';

import { ActionReducerMap, MetaReducer, createReducer, on } from '@ngrx/store';

import { CATEGORIES, CATEGORIES_SHEET_ID, SHEET_ID, SPREADSHEET_ID } from 'src/constants';
import { AppActions } from './app.actions';
import { AppState } from './app.model';
import { Category } from 'src/shared/models';

const sheetId = localStorage.getItem(SHEET_ID);
const categoriesSheetId = localStorage.getItem(CATEGORIES_SHEET_ID);
const categories = localStorage.getItem(CATEGORIES);

export const initialState: AppState = {
  loading: false,
  title: '',
  spreadsheetId: localStorage.getItem(SPREADSHEET_ID) ?? undefined,
  sheetId: sheetId ? parseInt(sheetId, 10) : undefined,
  categoriesSheetId: categoriesSheetId ? parseInt(categoriesSheetId, 10) : undefined,
  categories: categories ? (JSON.parse(categories) as Array<Category>) : [],
  expenses: []
};

export const reducers: ActionReducerMap<{ app: AppState }> = {
  app: createReducer(
    initialState,
    on(AppActions.loading, (state, { loading }) => ({ ...state, loading })),
    on(AppActions.setTitle, (state, { title }) => ({ ...state, title })),
    on(AppActions.spreadsheetId, (state, { spreadsheetId }) => ({ ...state, spreadsheetId })),
    on(AppActions.sheetId, (state, { sheetId }) => ({ ...state, sheetId })),
    on(AppActions.categoriesSheetId, (state, { categoriesSheetId }) => ({ ...state, categoriesSheetId })),
    on(AppActions.storeCategories, (state, { categories }) => ({ ...state, categories })),
    on(AppActions.storeExpenses, (state, { expenses }) => ({ ...state, expenses }))
  )
};

export const metaReducers: MetaReducer<{ app: AppState }>[] = isDevMode() ? [] : [];
