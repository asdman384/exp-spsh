import { Category, Expense } from 'src/shared/models';

export interface AppState {
  loading: boolean;
  title: string;
  spreadsheetId: string | undefined;
  sheetId: number | undefined;
  categoriesSheetId: number | undefined;
  categories: Array<Category>;
  expenses: Array<Expense>;
}
