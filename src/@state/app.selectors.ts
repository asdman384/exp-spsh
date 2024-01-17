import { createFeatureSelector, createSelector } from '@ngrx/store';

import { AppState } from './app.model';
import { sheetsAdapter } from './app.reducers';

const selectAppFeature = createFeatureSelector<AppState>('app');

// general
export const loadingSelector = createSelector(selectAppFeature, (state: AppState) => state.loading);
export const titleSelector = createSelector(selectAppFeature, ({ title, icon }: AppState) => ({ title, icon }));
export const spreadsheetIdSelector = createSelector(selectAppFeature, (state: AppState) => state.spreadsheetId);

// sheets
const { selectEntities, selectAll } = sheetsAdapter.getSelectors();
const sheetsStateSelector = createSelector(selectAppFeature, (state: AppState) => state.dataSheets);
const sheetEntitiesSelector = createSelector(sheetsStateSelector, selectEntities);
export const currentSheetIdSelector = createSelector(sheetsStateSelector, (state) => state.selectedSheetId);
export const sheetsSelector = createSelector(sheetsStateSelector, selectAll);
export const currentSheetSelector = createSelector(
  sheetEntitiesSelector,
  currentSheetIdSelector,
  (sheetEntities, selectedSheetId) => (selectedSheetId === null ? undefined : sheetEntities[selectedSheetId])
);
export const byIdSheetSelector = (id: string) =>
  createSelector(sheetEntitiesSelector, (sheetEntities) => sheetEntities[id]);

// categories
export const categoriesSheetIdSelector = createSelector(selectAppFeature, (state: AppState) => state.categoriesSheetId);
export const categoriesSelector = createSelector(selectAppFeature, (state: AppState) => state.categories);

// expenses
export const expensesSelector = createSelector(selectAppFeature, (state: AppState) => state.expenses);
