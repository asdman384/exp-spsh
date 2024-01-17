import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Category, Expense, Sheet } from 'src/shared/models';

export const AppActions = createActionGroup({
  source: 'App shell',
  events: {
    // general
    loading: props<{ loading: boolean }>(),
    setTitle: props<{ title: string; icon?: string }>(),

    // setup
    spreadsheetId: props<{ spreadsheetId: string | undefined }>(),
    setCurrentSheet: props<{ sheet: Sheet | string }>(),
    upsertDataSheet: props<{ dataSheet: Sheet }>(),
    categoriesSheetId: props<{ categoriesSheetId: number | undefined }>(),

    // categories
    loadCategories: emptyProps(),
    storeCategories: props<{ categories: Array<Category> }>(),
    addCategory: props<{ newCategory: Category }>(),
    deleteCategory: props<{ category: Category }>(),
    updateCategoryPosition: props<{ categories: Array<Category> }>(),

    // expenses
    addExpense: props<{ sheetId: number; expense: Expense }>(),
    loadExpenses: props<{ sheetId: number; from?: Date; to?: Date }>(),
    storeExpenses: props<{ expenses: Array<Expense> }>()
  }
});
