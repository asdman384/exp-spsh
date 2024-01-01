export interface AppState {
  title: string;
  spreadsheetId: string | undefined;
  sheetId: number | undefined;
  categoriesSheetId: number | undefined;
  categories: Array<string>;
}
