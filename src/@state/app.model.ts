import { Category } from 'src/shared/models';

export interface AppState {
  title: string;
  spreadsheetId: string | undefined;
  sheetId: number | undefined;
  categoriesSheetId: number | undefined;
  categories: Array<Category>;
}
