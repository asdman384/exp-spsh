import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Category } from 'src/shared/models';

export const AppActions = createActionGroup({
  source: 'App shell',
  events: {
    loading: props<{ loading: boolean }>(),
    setTitle: props<{ title: string }>(),
    spreadsheetId: props<{ spreadsheetId: string | undefined }>(),
    sheetId: props<{ sheetId: number | undefined }>(),
    categoriesSheetId: props<{ categoriesSheetId: number | undefined }>(),
    loadCategories: emptyProps(),
    storeCategories: props<{ categories: Array<Category> }>(),
    adCategory: props<{ newCategory: Category }>(),
    deleteCategory: props<{ category: Category }>(),
    updateCategoryPosition: props<{ categories: Array<Category> }>()
  }
});
