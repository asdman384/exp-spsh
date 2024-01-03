import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { CATEGORIES_SHEET_TITLE } from 'src/constants';
import { Category } from 'src/shared/models';

@Injectable({ providedIn: 'root' })
export class SpreadsheetService {
  constructor(private readonly http: HttpClient) {}

  /**
   *
   * @param spreadsheetId
   * @param param1
   * @returns
   */
  addCategory(spreadsheetId: string, { name, position }: Category): Promise<gapi.client.sheets.AppendValuesResponse> {
    return gapi.client.sheets.spreadsheets.values
      .append({
        spreadsheetId: spreadsheetId,
        range: `${CATEGORIES_SHEET_TITLE}!A1:B1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [[name, position]] }
      })
      .then((resp) => resp.result);
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
  ): Promise<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
    const deleteDimension: gapi.client.sheets.DeleteDimensionRequest = {
      range: { sheetId, dimension: 'ROWS', startIndex: index, endIndex: index + 1 }
    };

    return gapi.client.sheets.spreadsheets
      .batchUpdate({ spreadsheetId, resource: { requests: [{ deleteDimension }] } })
      .then((resp) => resp.result);
  }

  /**
   *
   * @param spreadsheetId
   * @returns
   */
  getAllCategories(spreadsheetId: string): Promise<Array<Category>> {
    return gapi.client.sheets.spreadsheets.values
      .get({
        spreadsheetId,
        valueRenderOption: 'UNFORMATTED_VALUE',
        range: CATEGORIES_SHEET_TITLE + `!A:B`
      })
      .then((resp) => resp.result.values?.map<Category>(([name, position]) => ({ name, position })) || []);
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
  addSheet(
    title: string,
    spreadsheetId: string,
    columnCount: number
  ): Promise<gapi.client.sheets.SheetProperties | undefined> {
    const addSheet: gapi.client.sheets.AddSheetRequest = {
      properties: { title, gridProperties: { rowCount: 1, columnCount } }
    };

    return gapi.client.sheets.spreadsheets
      .batchUpdate({ spreadsheetId, resource: { requests: [{ addSheet }] } })
      .then((response) => response.result.replies?.[0].addSheet?.properties);
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
  prependRow(spreadsheetId: string, sheetId: number): Promise<gapi.client.sheets.BatchUpdateSpreadsheetResponse> {
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
            { userEnteredValue: { stringValue: 'category' } },
            { userEnteredValue: { stringValue: 'description' } },
            { userEnteredValue: { numberValue: 1 } },
            { userEnteredValue: { numberValue: getDateSerialNumber(new Date()) } }
          ]
        }
      ]
    };

    return gapi.client.sheets.spreadsheets
      .batchUpdate({ spreadsheetId, resource: { requests: [{ insertDimension }, { updateCells }] } })
      .then((response) => response.result);
  }

  /**
   * https://developers.google.com/chart/interactive/docs/spreadsheets#example:-using-oauth-to-access-gviztq
   * @param spreadsheetId
   * @param sheetId
   */
  getData(spreadsheetId: string, sheetId: number) {
    const today = new Date();
    // https://developers.google.com/chart/interactive/docs/querylanguage#overview
    const gvizQuery = `
        select A, B, C, D 
        where D >= date '${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}'
    `.trim();

    this.http
      .get(
        `https://docs.google.com/a/google.com/spreadsheets/d/${spreadsheetId}` +
          `/gviz/tq?tq=${encodeURIComponent(gvizQuery)}` +
          `&gid=${sheetId}` +
          `&tqx=out:csv` +
          `&access_token=${encodeURIComponent(gapi.client.getToken().access_token)}`,
        { responseType: 'text' }
      )
      .subscribe(log);
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
  // Set the base date
  const baseDate = new Date('1899-12-29T21:00:00.000Z');

  // Calculate the difference in milliseconds
  const dateDifference = date.getTime() - baseDate.getTime();

  // Convert milliseconds to days
  const days = Math.trunc(dateDifference / (24 * 60 * 60 * 1000));

  // Get the fractional part representing the time
  const fractionalPart = (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / (24 * 60 * 60);

  // Combine the whole and fractional parts and return as SerialNumber
  return days + fractionalPart;
}
