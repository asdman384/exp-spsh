import { isDevMode } from '@angular/core';

import { ActionReducerMap, MetaReducer, createReducer, on } from '@ngrx/store';

import { EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { CATEGORIES, CATEGORIES_SHEET_ID, DATA_SHEETS, SPREADSHEET_ID } from 'src/constants';
import { Category, Sheet } from 'src/shared/models';
import { AppActions } from './app.actions';
import { AppState } from './app.model';

const categoriesSheetId = localStorage.getItem(CATEGORIES_SHEET_ID);
const categories = localStorage.getItem(CATEGORIES);

export const sheetsAdapter: EntityAdapter<Sheet> = createEntityAdapter<Sheet>({ selectId: (e) => e.title });

export const initialState: AppState = {
  loading: false,
  title: '',
  spreadsheetId: localStorage.getItem(SPREADSHEET_ID) ?? undefined,
  dataSheets: sheetsAdapter.getInitialState({ selectedSheetId: null }),
  categoriesSheetId: categoriesSheetId ? parseInt(categoriesSheetId, 10) : undefined,
  categories: categories ? (JSON.parse(categories) as Array<Category>) : [],
  expenses: []
};

// INIT DATA SHEETS
const initialDataSheets = localStorage.getItem(DATA_SHEETS);
if (initialDataSheets) {
  initialState.dataSheets = sheetsAdapter.upsertMany(
    JSON.parse(initialDataSheets) as unknown as Array<Sheet>,
    initialState.dataSheets
  );
}

export const reducers: ActionReducerMap<{ app: AppState }> = {
  app: createReducer(
    initialState,
    on(AppActions.loading, (state, { loading }) => ({ ...state, loading })),
    on(AppActions.setTitle, (state, { title }) => ({ ...state, title })),
    on(AppActions.spreadsheetId, (state, { spreadsheetId }) => ({ ...state, spreadsheetId })),
    on(AppActions.upsertDataSheet, (state, { dataSheet }) => ({
      ...state,
      dataSheets: sheetsAdapter.upsertOne(dataSheet, state.dataSheets)
    })),
    on(AppActions.setCurrentSheet, (state, { sheet }) => ({
      ...state,
      dataSheets: { ...state.dataSheets, selectedSheetId: typeof sheet === 'string' ? sheet : sheet.title }
    })),
    on(AppActions.categoriesSheetId, (state, { categoriesSheetId }) => ({ ...state, categoriesSheetId })),
    on(AppActions.storeCategories, (state, { categories }) => ({ ...state, categories })),
    on(AppActions.storeExpenses, (state, { expenses }) => ({ ...state, expenses }))
  )
};

export const metaReducers: MetaReducer<{ app: AppState }>[] = isDevMode() ? [] : [];
