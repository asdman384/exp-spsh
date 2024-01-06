import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppState } from './app.model';

const selectAppFeature = createFeatureSelector<AppState>('app');

export const loadingSelector = createSelector(selectAppFeature, (state: AppState) => state.loading);
export const titleSelector = createSelector(selectAppFeature, (state: AppState) => state.title);
export const spreadsheetIdSelector = createSelector(selectAppFeature, (state: AppState) => state.spreadsheetId);
export const sheetIdSelector = createSelector(selectAppFeature, (state: AppState) => state.sheetId);
export const categoriesSheetIdSelector = createSelector(selectAppFeature, (state: AppState) => state.categoriesSheetId);
export const categoriesSelector = createSelector(selectAppFeature, (state: AppState) => state.categories);
export const expensesSelector = createSelector(selectAppFeature, (state: AppState) => state.expenses);
