import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppState } from './app.model';

const selectAppFeature = createFeatureSelector<AppState>('app');

export const titleSelector = createSelector(selectAppFeature, (state: AppState) => state.title);
export const spreadsheetIdSelector = createSelector(selectAppFeature, (state: AppState) => state.spreadsheetId);
export const sheetIdSelector = createSelector(selectAppFeature, (state: AppState) => state.sheetId);
export const categoriesSheetIdSelector = createSelector(selectAppFeature, (state: AppState) => state.categoriesSheetId);
