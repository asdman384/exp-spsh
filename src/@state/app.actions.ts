import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Category, Expense } from 'src/shared/models';

export const AppActions = createActionGroup({
  source: 'App shell',
  events: {
    // general
    loading: props<{ loading: boolean }>(),
    setTitle: props<{ title: string }>(),

    // setup
    spreadsheetId: props<{ spreadsheetId: string | undefined }>(),
    sheetId: props<{ sheetId: number | undefined }>(),
    categoriesSheetId: props<{ categoriesSheetId: number | undefined }>(),

    // categories
    loadCategories: emptyProps(),
    storeCategories: props<{ categories: Array<Category> }>(),
    addCategory: props<{ newCategory: Category }>(),
    deleteCategory: props<{ category: Category }>(),
    updateCategoryPosition: props<{ categories: Array<Category> }>(),

    // expenses
    addExpense: props<{ expense: Expense }>(),
    loadExpenses: props<{ from?: Date; to?: Date }>(),
    storeExpenses: props<{ expenses: Array<Expense> }>()
  }
});
