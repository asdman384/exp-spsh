import { createActionGroup, props } from '@ngrx/store';

export const AppActions = createActionGroup({
  source: 'App shell',
  events: {
    'Set Title': props<{ title: string }>(),
    'Spreadsheet Id': props<{ spreadsheetId: string | undefined }>(),
    'Sheet Id': props<{ sheetId: number | undefined }>()
  }
});
