import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { Observable, map } from 'rxjs';

import { CATEGORIES_SHEET_TITLE } from 'src/constants';
import { nonZonePromiseToObservable } from 'src/shared/helpers';
import { Category, Expense } from 'src/shared/models';
import { SecurityService } from '../security.service';

import keys from '../../../keys.json';

@Injectable({ providedIn: 'root' })
export class SpreadsheetService {
  constructor(
    private readonly http: HttpClient,
    private readonly security: SecurityService,
    private readonly zone: NgZone
  ) {}

  updateCategories(
    spreadsheetId: string,
    categories: Array<Category>
  ): Observable<gapi.client.sheets.UpdateValuesResponse> {
    const request = gapi.client.sheets.spreadsheets.values
      .update({
        spreadsheetId,
        range: `${CATEGORIES_SHEET_TITLE}!A1:B${categories.length}`,
        valueInputOption: 'RAW',
        resource: { values: categories.map((c) => [c.name, c.id]) }
      })
      .then((resp) => resp.result);

    return nonZonePromiseToObservable(request, this.zone);
  }

  /**
   *
   * @param spreadsheetId
   * @param param1
   * @returns
   */
  addCategory(
    spreadsheetId: string,
    { name, id: position }: Category
  ): Observable<gapi.client.sheets.AppendValuesResponse> {
    const request = gapi.client.sheets.spreadsheets.values
      .append({
        spreadsheetId: spreadsheetId,
        range: `${CATEGORIES_SHEET_TITLE}!A1:B1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [[name, position]] }
      })
      .then((resp) => resp.result);

    return nonZonePromiseToObservable(request, this.zone);
  }

  /**
   *
   * @param spreadsheetId
   * @param sheetId
   * @param index
   * @returns
   */
  deleteCategory(
    spreadsheetId: string,
    sheetId: number,
    index: number
  ): Observable<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
    const deleteDimension: gapi.client.sheets.DeleteDimensionRequest = {
      range: { sheetId, dimension: 'ROWS', startIndex: index, endIndex: index + 1 }
    };

    const request = gapi.client.sheets.spreadsheets
      .batchUpdate({ spreadsheetId, resource: { requests: [{ deleteDimension }] } })
      .then((resp) => resp.result);

    return nonZonePromiseToObservable(request, this.zone);
  }

  /**
   *
   * @param spreadsheetId
   * @returns
   */
  getAllCategories(spreadsheetId: string): Observable<Array<Category>> {
    const request = gapi.client.sheets.spreadsheets.values
      .get({
        spreadsheetId,
        valueRenderOption: 'UNFORMATTED_VALUE',
        range: CATEGORIES_SHEET_TITLE + `!A:B`
      })
      .then((resp) => resp.result.values?.map<Category>(([name, position]) => ({ name, id: position })) || []);

    return nonZonePromiseToObservable(request, this.zone);
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest#rest-resource:-v4.spreadsheets
   * @param spreadsheetId
   * @returns
   */
  getSpreadsheet(spreadsheetId: string): Promise<gapi.client.sheets.Spreadsheet> {
    return gapi.client.sheets.spreadsheets
      .get({
        spreadsheetId
        // includeGridData: true
      })
      .then((response) => response.result);
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest#rest-resource:-v4.spreadsheets
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#addsheetrequest
   * @param title
   * @param spreadsheetId
   * @param columnCount
   * @returns
   */
  addSheet(title: string, spreadsheetId: string, columnCount: number): Promise<gapi.client.sheets.SheetProperties> {
    const addSheet: gapi.client.sheets.AddSheetRequest = {
      properties: { title, gridProperties: { rowCount: 1, columnCount } }
    };

    return gapi.client.sheets.spreadsheets
      .batchUpdate({ spreadsheetId, resource: { requests: [{ addSheet }] } })
      .then((response) => response.result.replies![0].addSheet!.properties!);
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#repeatcellrequest
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#updatedimensionpropertiesrequest
   * @param spreadsheetId
   * @param sheetId
   * @returns
   */
  setDataSheetFormats(
    spreadsheetId: string,
    sheetId: number
  ): Promise<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
    const dateCellValidation: gapi.client.sheets.RepeatCellRequest = {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1048576, startColumnIndex: 3, endColumnIndex: 4 },
      cell: {
        dataValidation: { condition: { type: 'DATE_IS_VALID' }, strict: true },
        effectiveFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'd"/"mm"/"yyyy" "HH":"mm' } },
        userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'd"/"mm"/"yyyy" "HH":"mm' } }
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

    return gapi.client.sheets.spreadsheets
      .batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            { repeatCell: dateCellValidation },
            { repeatCell: categoriesCellValidation },
            { repeatCell: currencyCellValidation },
            { updateDimensionProperties }
          ]
        }
      })
      .then((response) => response.result);
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#repeatcellrequest
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#updatedimensionpropertiesrequest
   * @param spreadsheetId
   * @param sheetId
   * @returns
   */
  setCategoriesSheetFormats(
    spreadsheetId: string,
    sheetId: number
  ): Promise<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
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

    return gapi.client.sheets.spreadsheets
      .batchUpdate({ spreadsheetId, resource: { requests: [{ repeatCell }] } })
      .then((response) => response.result);
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#insertdimensionrequest
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#updatecellsrequest
   * @param spreadsheetId The ID of the spreadsheet to update.
   * @param sheetId The ID of the sheet(tab) to update
   */
  addExpense(
    spreadsheetId: string,
    sheetId: number,
    expense: Expense,
    token: google.accounts.oauth2.TokenResponse
  ): Observable<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
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
            { userEnteredValue: { numberValue: getDateSerialNumber(expense.date!) } }
          ]
        }
      ]
    };

    log('request add expense');
    return this.http.post<gapi.client.sheets.BatchUpdateSpreadsheetResponse>(
      `https://content-sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate?alt=json&key=${keys.API_KEY}`,
      { requests: [{ insertDimension }, { updateCells }] },
      { headers: new HttpHeaders().set('Authorization', `Bearer ${token.access_token}`) }
    );
  }

  /**
   * https://developers.google.com/chart/interactive/docs/spreadsheets#example:-using-oauth-to-access-gviztq
   * https://developers.google.com/chart/interactive/docs/querylanguage#overview
   * @param spreadsheetId
   * @param sheetId
   */
  loadExpenses(
    spreadsheetId: string,
    filter: { sheetId: number; from?: Date; to?: Date },
    token: google.accounts.oauth2.TokenResponse
  ): Observable<Array<Expense>> {
    const from = filter.from ?? new Date();
    let gvizQuery = `
      select A, B, C, D 
      where D >= date '${from.getFullYear()}-${from.getMonth() + 1}-${from.getDate()}'
    `.trim();

    if (filter.to) {
      gvizQuery += `and D < date '${filter.to.getFullYear()}-${filter.to.getMonth() + 1}-${filter.to.getDate()}'`;
    }

    log('request expenses');
    return this.http
      .get(
        `https://docs.google.com/a/google.com/spreadsheets/d/${spreadsheetId}` +
          `/gviz/tq?tq=${encodeURIComponent(gvizQuery)}` +
          `&tqx=responseHandler:myResponseHandler&gid=${filter.sheetId}` +
          `&access_token=${encodeURIComponent(token.access_token)}`,
        { responseType: 'text' }
      )
      .pipe(map(translateTextToExpense));
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
function getDateSerialNumber(date: Date): number {
  return 25569.0 + (date.getTime() - date.getTimezoneOffset() * 60 * 1000) / (1000 * 60 * 60 * 24);
}

function translateTextToExpense(text: string): Array<Expense> {
  function myResponseHandler(data: ExpensesDTO): Array<Expense> {
    return data.table.rows.map<Expense>((row) => {
      const comment = row.c[1]?.v;
      return {
        category: String(row.c[0].v),
        comment: comment ? String(comment) : undefined,
        amount: Number(row.c[2].v),
        date: eval(`new ${row.c[3].v}`)
      };
    });
  }

  return eval(text);
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
