import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { CATEGORIES_SHEET_TITLE } from 'src/constants';
import { Category, Expense } from 'src/shared/models';

import keys from '../../../keys.json';

@Injectable({ providedIn: 'root' })
export class SpreadsheetService {
  private spreadsheetId: string = '';
  private get apiUrl(): string {
    return `https://content-sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`;
  }

  constructor(private readonly http: HttpClient) {}

  setSpreadsheetId(spreadsheetId: string): void {
    this.spreadsheetId = spreadsheetId;
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update
   * @param spreadsheetId
   * @param categories
   * @returns
   */
  updateCategories(categories: Array<Category>): Observable<gapi.client.sheets.UpdateValuesResponse> {
    const range = encodeURIComponent(`${CATEGORIES_SHEET_TITLE}!A1:B${categories.length}`);
    return this.http.put<gapi.client.sheets.UpdateValuesResponse>(
      `${this.apiUrl}/values/${range}`,
      { values: categories.map((c) => [c.name, c.id]) } as gapi.client.sheets.ValueRange,
      { params: new HttpParams({ fromObject: { valueInputOption: 'RAW', alt: 'json', key: keys.API_KEY } }) }
    );
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append
   * @param spreadsheetId
   * @param category Category
   * @returns
   */
  addCategory({ name, id }: Category): Observable<gapi.client.sheets.AppendValuesResponse> {
    const range = encodeURIComponent(`${CATEGORIES_SHEET_TITLE}!A1:B1`);
    return this.http.post<gapi.client.sheets.AppendValuesResponse>(
      `${this.apiUrl}/values/${range}:append`,
      { values: [[name, id]] } as gapi.client.sheets.ValueRange,
      {
        params: new HttpParams({
          fromObject: { insertDataOption: 'INSERT_ROWS', valueInputOption: 'RAW', alt: 'json', key: keys.API_KEY }
        })
      }
    );
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#deletedimensionrequest
   * @param spreadsheetId
   * @param sheetId
   * @param index
   * @returns
   */
  deleteSheetRow(sheetId: number, index: number): Observable<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
    const deleteDimension: gapi.client.sheets.DeleteDimensionRequest = {
      range: { sheetId, dimension: 'ROWS', startIndex: index, endIndex: index + 1 }
    };

    return this.http.post<gapi.client.sheets.BatchUpdateSpreadsheetResponse>(
      `${this.apiUrl}:batchUpdate`,
      { requests: [{ deleteDimension }] } as gapi.client.sheets.BatchUpdateSpreadsheetRequest,
      { params: new HttpParams({ fromObject: { alt: 'json', key: keys.API_KEY } }) }
    );
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/get
   * @param spreadsheetId
   * @returns Array<Category>
   */
  getAllCategories(): Observable<Array<Category>> {
    const range = encodeURIComponent(CATEGORIES_SHEET_TITLE + `!A:B`);

    return this.http
      .get<gapi.client.sheets.ValueRange>(`${this.apiUrl}/values/${range}`, {
        params: new HttpParams({ fromObject: { valueRenderOption: 'UNFORMATTED_VALUE', key: keys.API_KEY } })
      })
      .pipe(map((result) => result.values?.map<Category>(([name, position]) => ({ name, id: position })) || []));
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest#rest-resource:-v4.spreadsheets
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/get
   * @param spreadsheetId
   * @returns gapi.client.sheets.Spreadsheet
   */
  getSpreadsheet(spreadsheetId: string): Observable<gapi.client.sheets.Spreadsheet> {
    return this.http.get<gapi.client.sheets.Spreadsheet>(
      `https://content-sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
      {
        params: new HttpParams({ fromObject: { includeGridData: false, key: keys.API_KEY } })
      }
    );
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest#rest-resource:-v4.spreadsheets
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#addsheetrequest
   * @param title
   * @param spreadsheetId
   * @param columnCount
   * @returns
   */
  addSheet(title: string, columnCount: number): Observable<gapi.client.sheets.SheetProperties> {
    const addSheet: gapi.client.sheets.AddSheetRequest = {
      properties: { title, gridProperties: { rowCount: 1, columnCount } }
    };

    return this.http
      .post<gapi.client.sheets.BatchUpdateSpreadsheetResponse>(
        `${this.apiUrl}:batchUpdate`,
        { requests: [{ addSheet }] } as gapi.client.sheets.BatchUpdateSpreadsheetRequest,
        { params: new HttpParams({ fromObject: { alt: 'json', key: keys.API_KEY } }) }
      )
      .pipe(map((result) => result.replies![0].addSheet!.properties!));
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#repeatcellrequest
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#updatedimensionpropertiesrequest
   * @param spreadsheetId
   * @param sheetId
   * @returns
   */
  setDataSheetFormats(sheetId: number): Observable<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
    const dateCellValidation: gapi.client.sheets.RepeatCellRequest = {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1048576, startColumnIndex: 3, endColumnIndex: 4 },
      cell: {
        dataValidation: { condition: { type: 'DATE_IS_VALID' }, strict: true },
        effectiveFormat: { numberFormat: { type: 'DATE_TIME', pattern: `d/mm/yyyy HH:mm` } },
        userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: `d/mm/yyyy HH:mm` } }
      },
      fields: 'dataValidation.condition,effectiveFormat.numberFormat,userEnteredFormat.numberFormat'
    };

    const categoriesCellValidation: gapi.client.sheets.RepeatCellRequest = {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1048576, startColumnIndex: 0, endColumnIndex: 1 },
      cell: {
        dataValidation: {
          condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: `=${CATEGORIES_SHEET_TITLE}!$A:$A` }] },
          strict: true
        }
      },
      fields: 'dataValidation.condition'
    };

    const currencyCellValidation: gapi.client.sheets.RepeatCellRequest = {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1048576, startColumnIndex: 2, endColumnIndex: 3 },
      cell: {
        dataValidation: {
          condition: { type: 'NUMBER_GREATER_THAN_EQ', values: [{ userEnteredValue: '0' }] },
          strict: true
        }
      },
      fields: 'dataValidation.condition'
    };

    const updateDimensionProperties = {
      properties: { pixelSize: 120 },
      range: { dimension: 'COLUMNS', sheetId, startIndex: 3, endIndex: 4 },
      fields: 'pixelSize'
    };

    return this.http.post<gapi.client.sheets.BatchUpdateSpreadsheetResponse>(
      `${this.apiUrl}:batchUpdate`,
      {
        requests: [
          { repeatCell: dateCellValidation },
          { repeatCell: categoriesCellValidation },
          { repeatCell: currencyCellValidation },
          { updateDimensionProperties }
        ]
      } as gapi.client.sheets.BatchUpdateSpreadsheetRequest,
      { params: new HttpParams({ fromObject: { alt: 'json', key: keys.API_KEY } }) }
    );
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#repeatcellrequest
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#updatedimensionpropertiesrequest
   * @param spreadsheetId
   * @param sheetId
   * @returns
   */
  setCategoriesSheetFormats(sheetId: number): Observable<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
    const repeatCell: gapi.client.sheets.RepeatCellRequest = {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1048576, startColumnIndex: 1, endColumnIndex: 2 },
      cell: {
        dataValidation: {
          condition: { type: 'NUMBER_GREATER_THAN_EQ', values: [{ userEnteredValue: '0' }] },
          strict: true
        }
      },
      fields: 'dataValidation.condition'
    };

    return this.http.post<gapi.client.sheets.BatchUpdateSpreadsheetResponse>(
      `${this.apiUrl}:batchUpdate`,
      { requests: [{ repeatCell }] } as gapi.client.sheets.BatchUpdateSpreadsheetRequest,
      { params: new HttpParams({ fromObject: { alt: 'json', key: keys.API_KEY } }) }
    );
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#insertdimensionrequest
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#updatecellsrequest
   * @param spreadsheetId The ID of the spreadsheet to update.
   * @param sheetId The ID of the sheet(tab) to update
   */
  addExpense(sheetId: number, expense: Expense): Observable<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
    const insertDimension: gapi.client.sheets.InsertDimensionRequest = {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      inheritFromBefore: false
    };

    const updateCells: gapi.client.sheets.UpdateCellsRequest = {
      fields: 'userEnteredValue',
      start: { sheetId, rowIndex: 0, columnIndex: 0 },
      rows: [
        {
          values: [
            { userEnteredValue: { stringValue: expense.category } },
            { userEnteredValue: { stringValue: expense.comment } },
            { userEnteredValue: { numberValue: expense.amount } },
            { userEnteredValue: { numberValue: getSerialNumberFromDate(expense.date!) } }
          ]
        }
      ]
    };

    return this.http.post<gapi.client.sheets.BatchUpdateSpreadsheetResponse>(
      `${this.apiUrl}:batchUpdate`,
      { requests: [{ insertDimension }, { updateCells }] } as gapi.client.sheets.BatchUpdateSpreadsheetRequest,
      { params: new HttpParams({ fromObject: { alt: 'json', key: keys.API_KEY } }) }
    );
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/get
   * @param sheetName
   * @param take
   */
  loadLastExpenses(sheetName: string, take: number = 1): Observable<Array<Expense>> {
    const range = encodeURIComponent(sheetName + `!A1:D${take}`);

    return this.http
      .get<gapi.client.sheets.ValueRange>(`${this.apiUrl}/values/${range}`, {
        params: new HttpParams({ fromObject: { valueRenderOption: 'UNFORMATTED_VALUE', key: keys.API_KEY } })
      })
      .pipe(
        map(
          (result) =>
            result.values?.map<Expense>(([category, comment, amount, date]) => ({
              category,
              comment: comment ? String(comment) : undefined,
              amount,
              date: getDateFromSerialNumber(date)
            })) ?? []
        )
      );
  }

  /**
   * https://developers.google.com/chart/interactive/docs/spreadsheets#example:-using-oauth-to-access-gviztq
   * https://developers.google.com/chart/interactive/docs/querylanguage#overview
   * @param spreadsheetId
   * @param sheetId
   */
  loadExpenses(filter: { sheetId: number; from?: Date; to?: Date }): Observable<Array<Expense>> {
    const from = filter.from ?? new Date();
    let tq = `
      select A, B, C, D 
      where D >= date '${from.getFullYear()}-${from.getMonth() + 1}-${from.getDate()}'
    `.trim();

    if (filter.to) {
      tq += ` and D < date '${filter.to.getFullYear()}-${filter.to.getMonth() + 1}-${filter.to.getDate()}'`;
    }

    // need to define `responseHandler` function right there to be available at the following `eval`'s scope
    function responseHandler(data: ExpensesDTO): Array<Expense> {
      return data.table.rows.map<Expense>((row) => {
        const comment = row.c[1]?.v;
        return {
          category: String(row.c[0].v),
          comment: comment ? String(comment) : undefined,
          amount: Number(row.c[2].v),
          date: secureParseDate(row.c[3].v as string)
        };
      });
    }

    return this.http
      .get(`https://docs.google.com/a/google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq`, {
        responseType: 'text',
        params: new HttpParams({
          fromObject: { tq, tqx: `responseHandler:${responseHandler.name}`, gid: filter.sheetId }
        })
      })
      .pipe(map((response) => eval(response)));
  }

  /**
   * @deprecated
   * @param sheetId
   * @param expense
   * @returns
   */
  append(sheetId: number, expense: Array<Expense>) {
    const appendCells: gapi.client.sheets.AppendCellsRequest = {
      fields: 'userEnteredValue',
      sheetId,
      rows: expense.map((e) => ({
        values: [
          { userEnteredValue: { stringValue: e.category } },
          { userEnteredValue: { stringValue: e.comment } },
          { userEnteredValue: { numberValue: e.amount } },
          { userEnteredValue: { numberValue: getSerialNumberFromDate(e.date!) } }
        ]
      }))
    };

    return this.http.post<gapi.client.sheets.BatchUpdateSpreadsheetResponse>(
      `${this.apiUrl}:batchUpdate`,
      { requests: [{ appendCells }] } as gapi.client.sheets.BatchUpdateSpreadsheetRequest,
      { params: new HttpParams({ fromObject: { alt: 'json', key: keys.API_KEY } }) }
    );
  }
}

/**
 * https://developers.google.com/sheets/api/reference/rest/v4/DateTimeRenderOption
 * Instructs date, time, datetime, and duration fields to be output as doubles in "serial number" format, as popularized by Lotus 1-2-3.
 * The whole number portion of the value (left of the decimal) counts the days since December 30th 1899.
 * The fractional portion (right of the decimal) counts the time as a fraction of the day.
 * For example, January 1st 1900 at noon would be 2.5, 2 because it's 2 days after December 30th 1899, and .5 because noon is half a day.
 * February 1st 1900 at 3pm would be 33.625. This correctly treats the year 1900 as not a leap year.
 * @param date
 * @returns SERIAL_NUMBER
 */
function getSerialNumberFromDate(date: Date): number {
  return 25569.0 + (date.getTime() - date.getTimezoneOffset() * 60 * 1000) / (1000 * 60 * 60 * 24);
}

function getDateFromSerialNumber(date: number): Date {
  const time = (date + 0.0000000001 - 25569.0) * 1000 * 60 * 60 * 24 + new Date().getTimezoneOffset() * 60 * 1000;
  return new Date(time);
}

interface ExpensesDTO {
  table: {
    cols: Array<{
      id: string;
      label: string;
      type: 'string' | 'number' | 'datetime';
      pattern?: 'General' | string;
    }>;

    rows: Array<{
      c: Array<{ v: string | number; f?: string }>;
    }>;
  };
}

/**
 * @param value string date representation example: Date(2024,0,16,12,14,23)
 */
function secureParseDate(value: string): Date {
  const regex = /^Date\((\d{4}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2})\)$/;
  const isMatch = regex.test(value);
  if (isMatch) {
    return (0, eval)(`new ${value}`);
  }

  throw Error('should provide a valid date');
}
