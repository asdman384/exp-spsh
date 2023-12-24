import { createActionGroup, props } from '@ngrx/store';

export const AppActions = createActionGroup({
  source: 'App shell',
  events: {
    'Set Title': props<{ title: string }>()
  }
});
