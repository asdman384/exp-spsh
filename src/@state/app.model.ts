import { EntityState } from '@ngrx/entity';
import { Category, Expense, Sheet } from 'src/shared/models';

export interface SheetsState extends EntityState<Sheet> {
  selectedSheetId: string | null;
}
export interface AppState {
  loading: boolean;
  title: string;
  icon?: string;
  spreadsheetId: string | undefined;
  dataSheets: SheetsState;
  categoriesSheetId: number | undefined;
  categories: Array<Category>;
  expenses: Array<Expense>;
}
