import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpreadsheetService {
  constructor() {}

  /**
   * https://developers.google.com/sheets/api/reference/rest#rest-resource:-v4.spreadsheets
   * @param spreadsheetId
   * @returns
   */
  getSpreadsheet(spreadsheetId: string): Promise<gapi.client.sheets.Spreadsheet> {
    return gapi.client.sheets.spreadsheets
      .get({ spreadsheetId, includeGridData: true })
      .then((response) => response.result);
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest#rest-resource:-v4.spreadsheets
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#addsheetrequest
   * @param spreadsheetId
   * @returns
   */
  addSheet(title: string, spreadsheetId: string): Promise<gapi.client.sheets.SheetProperties | undefined> {
    const addSheet: gapi.client.sheets.AddSheetRequest = {
      properties: { title, gridProperties: { rowCount: 1, columnCount: 4 } }
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
  setSheetFormats(spreadsheetId: string, sheetId: number) {
    const repeatCell: gapi.client.sheets.RepeatCellRequest = {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 1048576,
        startColumnIndex: 3,
        endColumnIndex: 4
      },
      cell: {
        dataValidation: { condition: { type: 'DATE_IS_VALID' } },
        effectiveFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'd"/"mm"/"yyyy" "HH":"mm' } },
        userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'd"/"mm"/"yyyy" "HH":"mm' } }
      },
      fields: 'dataValidation.condition,effectiveFormat.numberFormat,userEnteredFormat.numberFormat'
    };

    const updateDimensionProperties = {
      properties: { pixelSize: 120 },
      range: { dimension: 'COLUMNS', sheetId, startIndex: 3, endIndex: 4 },
      fields: 'pixelSize'
    };

    return gapi.client.sheets.spreadsheets
      .batchUpdate({ spreadsheetId, resource: { requests: [{ repeatCell }, { updateDimensionProperties }] } })
      .then((response) => response.result);
  }

  /**
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#insertdimensionrequest
   * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#updatecellsrequest
   * @param spreadsheetId The ID of the spreadsheet to update.
   * @param sheetId The ID of the sheet(tab) to update
   */
  prependRow(spreadsheetId: string, sheetId: number) {
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
            { userEnteredValue: { stringValue: 'qqq' } },
            { userEnteredValue: { stringValue: 'category' } },
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
