import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppState } from './app.model';

const selectAppFeature = createFeatureSelector<AppState>('app');

export const selectTitle = createSelector(selectAppFeature, (state: AppState) => state.title);
