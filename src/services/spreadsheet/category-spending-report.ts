import { CATEGORIES_SHEET_TITLE, DATA_SHEET_TITLE_PREFIX } from 'src/constants/spreadsheets';

export type ReportOutcome = 'absent' | 'ready' | 'title-conflict' | 'roster-conflict';

const REPORT_TITLE = 'Overview';
const REPORT_MONTHS = 13; // The 12 previous calendar months and the current month.
const REPORT_KEY = 'exp_spsh.report';
const REPORT_VALUE = 'category_spending_v1';
const ROSTER_COLUMN = 3; // Overview!D:D
const AMOUNT_LABEL = 'Spending';
const AMOUNT_FORMAT = { numberFormat: { type: 'NUMBER', pattern: '#,##0.00' } };

type SheetsRequest = gapi.client.sheets.Request;
type Cell = gapi.client.sheets.CellData;

interface ReportUpdate {
  outcome: ReportOutcome;
  requests: SheetsRequest[];
}

export function categorySpendingReportUpdate(spreadsheet: gapi.client.sheets.Spreadsheet, createIfMissing: boolean): ReportUpdate {
  const sheets = spreadsheet.sheets ?? [];
  const tags = sheets.flatMap(sheet =>
    (sheet.developerMetadata ?? [])
      .filter(tag => tag.metadataKey === REPORT_KEY && tag.metadataValue === REPORT_VALUE)
      .map(tag => ({ tag, sheet })),
  );
  const report = tags[0]?.sheet;
  const people = sheets
    .filter(sheet => sheet !== report)
    .map(sheet => sheet.properties)
    .sort((left, right) => (left?.index ?? 0) - (right?.index ?? 0))
    .map(properties => properties?.title ?? '')
    .filter(title => title.startsWith(DATA_SHEET_TITLE_PREFIX))
    .map(title => title.slice(DATA_SHEET_TITLE_PREFIX.length))
    .filter(name => name.trim().length > 0);

  if (report) {
    const properties = report.properties;
    const rowCount = properties?.gridProperties?.rowCount;
    const tag = tags[0].tag;
    if (
      tags.length !== 1 ||
      tag.visibility !== 'DOCUMENT' ||
      properties?.sheetId === undefined ||
      tag.location?.sheetId !== properties.sheetId ||
      (properties.sheetType ?? 'GRID') !== 'GRID' ||
      ROSTER_COLUMN >= (properties.gridProperties?.columnCount ?? 0) ||
      !rowCount
    ) {
      return { outcome: 'roster-conflict', requests: [] };
    }
    const requests: SheetsRequest[] = [];
    if (people.length > rowCount) {
      requests.push({ appendDimension: { sheetId: properties.sheetId, dimension: 'ROWS', length: people.length - rowCount } });
    }
    requests.push(rosterUpdate(properties.sheetId, people));
    return { outcome: 'ready', requests };
  }

  if (sheets.some(sheet => sheet.properties?.title?.toLowerCase() === REPORT_TITLE.toLowerCase())) {
    return { outcome: 'title-conflict', requests: [] };
  }
  if (!createIfMissing) return { outcome: 'absent', requests: [] };

  const usedIds = new Set(sheets.map(sheet => sheet.properties?.sheetId));
  let sheetId = 1;
  while (usedIds.has(sheetId)) sheetId++;
  return { outcome: 'ready', requests: createReport(sheetId, people) };
}

function label(value: string): Cell {
  return { userEnteredValue: { stringValue: value } };
}

function selector(source: string): Cell {
  return {
    dataValidation: { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: source }] }, strict: true, showCustomUi: true },
  };
}

function rosterUpdate(sheetId: number, people: string[]): SheetsRequest {
  // With a range, Sheets also clears old values below the last supplied row.
  const range = { sheetId, startColumnIndex: ROSTER_COLUMN, endColumnIndex: ROSTER_COLUMN + 1 };
  return { updateCells: { range, fields: 'userEnteredValue', rows: people.map(person => ({ values: [label(person)] })) } };
}

// Semicolons work in both decimal-comma and decimal-point workbooks.
const SELECTED_TAB = `"'${DATA_SHEET_TITLE_PREFIX}"&SUBSTITUTE($B$1;"'";"''")&"'!"`;
const BLANK = 'IFERROR(NA())';
const FIRST_DATE = `=IFERROR(IF(AND($B$1<>"";OR(ARRAYFORMULA(EXACT($B$1;$D:$D))));LET(purchase_dates;INDIRECT(${SELECTED_TAB}&"D:D");IF(COUNT(purchase_dates)>0;MIN(purchase_dates);${BLANK}));${BLANK}))`;

function monthRow(row: number): gapi.client.sheets.RowData {
  const start = `A${row}`;
  const end = `EDATE(${start};1)`;
  const month = row === 5 ? `=EOMONTH(TODAY();-${REPORT_MONTHS})+1` : `=EDATE(A${row - 1};1)`;
  const outsideHistory = `OR($B$1="";$B$2="";NOT(ISNUMBER($E$1));$E$1>=${end})`;
  const matchingRows = `FILTER(INDIRECT(tab_ref&"C:C");ARRAYFORMULA(EXACT(INDIRECT(tab_ref&"A:A");$B$2));purchase_dates>=${start};purchase_dates<${end})`;
  const total = `LET(tab_ref;${SELECTED_TAB};purchase_dates;INDIRECT(tab_ref&"D:D");IFNA(SUM(${matchingRows});0))`;
  return {
    values: [
      { userEnteredValue: { formulaValue: month }, userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'mmm yyyy' } } },
      {
        userEnteredValue: { formulaValue: `=IF(${outsideHistory};${BLANK};${total})` },
        userEnteredFormat: AMOUNT_FORMAT,
      },
    ],
  };
}

function createReport(sheetId: number, people: string[]): SheetsRequest[] {
  const chartRange = { sheetId, startRowIndex: 3, endRowIndex: 4 + REPORT_MONTHS };
  const domain = { sourceRange: { sources: [{ ...chartRange, startColumnIndex: 4, endColumnIndex: 5 }] } };
  const series = { sourceRange: { sources: [{ ...chartRange, startColumnIndex: 1, endColumnIndex: 2 }] } };
  const lastAmount = { ...chartRange, startRowIndex: chartRange.endRowIndex - 1, startColumnIndex: 1, endColumnIndex: 2 };
  const monthlyAmounts = `B5:B${chartRange.endRowIndex}`;
  const rows: gapi.client.sheets.RowData[] = [
    { values: [label('user'), selector(`=${REPORT_TITLE}!$D:$D`)] },
    { values: [label('Category'), selector(`=${CATEGORIES_SHEET_TITLE}!$A:$A`)] },
    {
      values: [
        label('Period total'),
        { userEnteredValue: { formulaValue: `=IF(COUNT(${monthlyAmounts});SUM(${monthlyAmounts});"")` }, userEnteredFormat: AMOUNT_FORMAT },
      ],
    },
    { values: [label('Month'), label(AMOUNT_LABEL)] },
    ...Array.from({ length: REPORT_MONTHS }, (_, month) => monthRow(5 + month)),
  ];
  return [
    {
      addSheet: {
        properties: { sheetId, title: REPORT_TITLE, gridProperties: { rowCount: Math.max(40, people.length), columnCount: 10 } },
      },
    },
    {
      createDeveloperMetadata: {
        developerMetadata: { metadataKey: REPORT_KEY, metadataValue: REPORT_VALUE, visibility: 'DOCUMENT', location: { sheetId } },
      },
    },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        fields: 'userEnteredValue,userEnteredFormat.numberFormat,dataValidation',
        rows,
      },
    },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 4 },
        fields: 'userEnteredValue',
        rows: [
          { values: [{ userEnteredValue: { formulaValue: FIRST_DATE } }] },
          {},
          {},
          { values: [label('Month')] },
          // A categorical domain gives each month its own tick, including the last month.
          ...Array.from({ length: REPORT_MONTHS }, (_, i) => ({
            values: [{ userEnteredValue: { formulaValue: `=TEXT(A${5 + i};"mmm yyyy")` } }],
          })),
        ],
      },
    },
    rosterUpdate(sheetId, people),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 5 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    },
    // Sheets discards the series style and axis title when all amounts are blank at chart creation.
    // Give it a numeric cell to infer the series type, then restore the formula in the same atomic batch.
    { repeatCell: { range: lastAmount, cell: { userEnteredValue: { numberValue: 0 } }, fields: 'userEnteredValue' } },
    {
      addChart: {
        chart: {
          position: { overlayPosition: { anchorCell: { sheetId, rowIndex: chartRange.endRowIndex + 1, columnIndex: 0 } } },
          spec: {
            title: 'Spending by category',
            hiddenDimensionStrategy: 'SHOW_ALL',
            basicChart: {
              chartType: 'LINE',
              headerCount: 1,
              interpolateNulls: false,
              legendPosition: 'NO_LEGEND',
              axis: [
                { position: 'BOTTOM_AXIS', title: 'Month' },
                { position: 'LEFT_AXIS', title: AMOUNT_LABEL },
              ],
              domains: [{ domain }],
              series: [{ series, targetAxis: 'LEFT_AXIS', pointStyle: { shape: 'CIRCLE', size: 6 } }],
            },
          },
        },
      },
    },
    { repeatCell: { range: lastAmount, cell: rows[chartRange.endRowIndex - 1].values![1], fields: 'userEnteredValue' } },
  ];
}
