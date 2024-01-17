import { isDevMode } from '@angular/core';

import { ActionReducerMap, MetaReducer, createReducer, on } from '@ngrx/store';

import { EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { CATEGORIES, CATEGORIES_SHEET_ID, DATA_SHEETS, SPREADSHEET_ID } from 'src/constants';
import { LocalStorageService } from 'src/services';
import { Category, Sheet } from 'src/shared/models';
import { AppActions } from './app.actions';
import { AppState } from './app.model';

export const sheetsAdapter: EntityAdapter<Sheet> = createEntityAdapter<Sheet>({ selectId: (e) => e.title });

export const initialState: AppState = {
  loading: false,
  title: '',
  icon: undefined,
  spreadsheetId: LocalStorageService.get<string>(SPREADSHEET_ID) ?? undefined,
  dataSheets: sheetsAdapter.getInitialState({ selectedSheetId: null }),
  categoriesSheetId: LocalStorageService.get<number>(CATEGORIES_SHEET_ID) ?? undefined,
  categories: LocalStorageService.get<Array<Category>>(CATEGORIES) ?? [],
  expenses: []
};

// INIT DATA SHEETS
const initialDataSheets = LocalStorageService.get<Array<Sheet>>(DATA_SHEETS);
if (initialDataSheets) {
  initialState.dataSheets = sheetsAdapter.upsertMany(initialDataSheets, initialState.dataSheets);
}

export const reducers: ActionReducerMap<{ app: AppState }> = {
  app: createReducer(
    initialState,
    on(AppActions.loading, (state, { loading }) => ({ ...state, loading })),
    on(AppActions.setTitle, (state, { title, icon }) => ({ ...state, title, icon })),
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
