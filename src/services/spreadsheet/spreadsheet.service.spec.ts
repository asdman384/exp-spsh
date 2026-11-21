import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CATEGORIES_SHEET_TITLE } from 'src/constants';
import { Category, Expense } from 'src/shared/models';

import { SpreadsheetService } from './spreadsheet.service';

describe('SpreadsheetService', () => {
  let service: SpreadsheetService;
  let httpMock: HttpTestingController;

  const SPREADSHEET_ID = 'test-spreadsheet-id';
  const SHEET_ID = 42;
  const SHEET_NAME = 'Sheet1';

  const baseExpense: Expense = {
    category: 'Food',
    comment: 'lunch',
    amount: 12.5,
    date: new Date(2024, 0, 16, 12, 14, 23),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(SpreadsheetService);
    httpMock = TestBed.inject(HttpTestingController);
    service.setSpreadsheetId(SPREADSHEET_ID);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createSpreadsheet()', () => {
    it('posts the Expenses title and returns the spreadsheet response', () => {
      const response: gapi.client.sheets.Spreadsheet = { spreadsheetId: 'created-id', properties: { title: 'Expenses' } };
      const next = vi.fn();
      service.createSpreadsheet().subscribe(next);
      const request = httpMock.expectOne(req => req.url === 'https://sheets.googleapis.com/v4/spreadsheets');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ properties: { title: 'Expenses' } });
      expect(request.request.params.has('key')).toBe(true);
      expect(request.request.params.get('alt')).toBe('json');
      request.flush(response);
      expect(next).toHaveBeenCalledExactlyOnceWith(response);
    });

    it('passes errors to the caller without another creation request', () => {
      const error = vi.fn();
      service.createSpreadsheet().subscribe({ error });
      httpMock.expectOne(req => req.method === 'POST').flush('Failed', { status: 503, statusText: 'Unavailable' });
      expect(error).toHaveBeenCalledOnce();
      expect(error.mock.calls[0][0].status).toBe(503);
      httpMock.expectNone(req => req.method === 'POST');
    });
  });

  describe('syncCategorySpendingReport()', () => {
    const fileUrl = 'https://content-sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID;
    const tag: gapi.client.sheets.DeveloperMetadata = {
      metadataKey: 'exp_spsh.report',
      metadataValue: 'category_spending_v1',
      visibility: 'DOCUMENT',
      location: { sheetId: 3 },
    };
    const rosterColumn = { sheetId: 3, startColumnIndex: 3, endColumnIndex: 4 };
    const report: gapi.client.sheets.Sheet = {
      properties: { sheetId: 3, title: 'Renamed report', gridProperties: { rowCount: 40, columnCount: 10 } },
      developerMetadata: [tag],
      charts: [{ chartId: 18, spec: { title: 'Owner title' } }],
    };
    const personalTabs: gapi.client.sheets.Sheet[] = [
      { properties: { sheetId: 2, title: "data_O'Brien Jr", index: 1 } },
      { properties: { sheetId: 1, title: 'data_Alex_Smith', index: 0 } },
      { properties: { sheetId: 4, title: 'data_hidden', hidden: true, index: 2 } },
      { properties: { sheetId: 5, title: 'data_chart', sheetType: 'OBJECT', index: 3 } },
      { properties: { sheetId: 6, title: 'data_' } },
      { properties: { sheetId: 7, title: 'unrelated_data_name' } },
    ];
    const rosterRows = ['Alex_Smith', "O'Brien Jr", 'hidden', 'chart'].map(stringValue => ({ values: [{ userEnteredValue: { stringValue } }] }));

    function readMetadata() {
      return httpMock.expectOne(req => req.method === 'GET' && req.url === fileUrl && req.params.get('includeGridData') === 'false');
    }

    function writeReport() {
      const write = httpMock.expectOne(req => req.method === 'POST' && req.url === fileUrl + ':batchUpdate');
      expect(write.request.params.get('alt')).toBe('json');
      expect(write.request.params.has('key')).toBe(true);
      return write;
    }

    it('inspects an unconfigured spreadsheet without creating a report', () => {
      const next = vi.fn();
      service.syncCategorySpendingReport(SPREADSHEET_ID, false).subscribe(next);
      readMetadata().flush({ sheets: personalTabs });
      expect(next).toHaveBeenCalledExactlyOnceWith('absent');
    });

    it('creates one complete report in the requested file using the first available positive sheet ID', () => {
      const next = vi.fn();
      service.syncCategorySpendingReport(SPREADSHEET_ID, true).subscribe(next);
      service.setSpreadsheetId('different-file');
      readMetadata().flush({ sheets: personalTabs });
      const write = writeReport();
      const requests: gapi.client.sheets.Request[] = write.request.body.requests;
      expect(requests[0].addSheet?.properties).toMatchObject({
        sheetId: 3,
        title: 'Overview',
        gridProperties: { rowCount: 40, columnCount: 10 },
      });
      expect(requests.map(request => Object.keys(request)[0])).toEqual([
        'addSheet',
        'createDeveloperMetadata',
        'updateCells',
        'updateCells',
        'updateCells',
        'updateDimensionProperties',
        'repeatCell',
        'addChart',
        'repeatCell',
      ]);
      expect(requests[1].createDeveloperMetadata?.developerMetadata).toEqual(tag);
      const grid = requests[2].updateCells!;
      expect(grid.start).toEqual({ sheetId: 3, rowIndex: 0, columnIndex: 0 });
      expect(grid.fields).toContain('dataValidation');
      const rows = grid.rows!;
      for (const [index, source] of ['=Overview!$D:$D', '=categories!$A:$A'].entries()) {
        expect(rows[index].values![1]).toEqual({
          dataValidation: { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: source }] }, strict: true, showCustomUi: true },
        });
      }
      expect(rows[2].values![0].userEnteredValue?.stringValue).toBe('Period total');
      expect(rows[2].values![1].userEnteredValue?.formulaValue).toBe('=IF(COUNT(B5:B17);SUM(B5:B17);"")');
      expect(rows[4].values![0].userEnteredValue?.formulaValue).toBe('=EOMONTH(TODAY();-13)+1');
      expect(rows).toHaveLength(17);
      for (const [index, row] of rows.slice(4).entries()) {
        const [month, amount] = row.values!;
        if (index > 0) expect(month.userEnteredValue?.formulaValue).toBe(`=EDATE(A${index + 4};1)`);
        expect(month.userEnteredFormat?.numberFormat).toEqual({ type: 'DATE', pattern: 'mmm yyyy' });
        expect(amount.userEnteredFormat?.numberFormat).toEqual({ type: 'NUMBER', pattern: '#,##0.00' });
        for (const text of ['EXACT(', '"A:A"', '"C:C"', '"D:D"', `A${index + 5}`, 'EDATE(']) {
          expect(amount.userEnteredValue?.formulaValue).toContain(text);
        }
        expect(amount.userEnteredValue?.formulaValue).not.toContain('"E:E"');
      }
      const history = requests[3].updateCells!;
      expect(history.start).toEqual({ sheetId: 3, rowIndex: 0, columnIndex: 4 });
      expect(history.rows![0].values![0].userEnteredValue?.formulaValue).toContain('MIN(');
      expect(history.rows!.slice(4).map(row => row.values![0].userEnteredValue?.formulaValue)).toEqual(
        Array.from({ length: 13 }, (_, i) => `=TEXT(A${5 + i};"mmm yyyy")`),
      );
      expect(requests[4].updateCells).toEqual({ range: rosterColumn, fields: 'userEnteredValue', rows: rosterRows });
      expect(requests[5].updateDimensionProperties).toMatchObject({
        range: { sheetId: 3, dimension: 'COLUMNS', startIndex: 3, endIndex: 5 },
        properties: { hiddenByUser: true },
      });
      const lastAmount = { sheetId: 3, startRowIndex: 16, endRowIndex: 17, startColumnIndex: 1, endColumnIndex: 2 };
      expect(requests[6].repeatCell).toEqual({
        range: lastAmount,
        cell: { userEnteredValue: { numberValue: 0 } },
        fields: 'userEnteredValue',
      });
      const chart = requests[7].addChart!.chart!;
      expect(requests[8].repeatCell).toEqual({ range: lastAmount, cell: rows[16].values![1], fields: 'userEnteredValue' });
      const chartRange = { sheetId: 3, startRowIndex: 3, endRowIndex: 17 };
      expect(chart.position?.overlayPosition?.anchorCell).toEqual({ sheetId: 3, rowIndex: 18, columnIndex: 0 });
      expect(chart.spec?.hiddenDimensionStrategy).toBe('SHOW_ALL');
      expect(chart.spec?.basicChart).toMatchObject({
        chartType: 'LINE',
        interpolateNulls: false,
        headerCount: 1,
        axis: [
          { position: 'BOTTOM_AXIS', title: 'Month' },
          { position: 'LEFT_AXIS', title: 'Spending' },
        ],
        domains: [{ domain: { sourceRange: { sources: [{ ...chartRange, startColumnIndex: 4, endColumnIndex: 5 }] } } }],
        series: [
          {
            series: { sourceRange: { sources: [{ ...chartRange, startColumnIndex: 1, endColumnIndex: 2 }] } },
            targetAxis: 'LEFT_AXIS',
            pointStyle: { shape: 'CIRCLE', size: 6 },
          },
        ],
      });
      expect(next).not.toHaveBeenCalled();
      write.flush({});
      expect(next).toHaveBeenCalledExactlyOnceWith('ready');
    });

    it('refreshes column D on later visits and adds rows when needed', () => {
      for (const rowCount of [rosterRows.length - 1, rosterRows.length]) {
        const currentReport = { ...report, properties: { ...report.properties, gridProperties: { rowCount, columnCount: 10 } } };
        const next = vi.fn();
        service.syncCategorySpendingReport(SPREADSHEET_ID, false).subscribe(next);
        readMetadata().flush({ sheets: [currentReport, ...personalTabs] });
        const write = writeReport();
        const update = { updateCells: { range: rosterColumn, fields: 'userEnteredValue', rows: rosterRows } };
        expect(write.request.body.requests).toEqual(
          rowCount < rosterRows.length ? [{ appendDimension: { sheetId: 3, dimension: 'ROWS', length: 1 } }, update] : [update],
        );
        write.flush({});
        expect(next).toHaveBeenCalledExactlyOnceWith('ready');
      }
    });

    it.each<[string, gapi.client.sheets.Spreadsheet, string]>([
      ['occupied title', { sheets: [{ properties: { title: 'overVIEW' } }] }, 'title-conflict'],
      ['two markers', { sheets: [report, { ...report, properties: { sheetId: 9 } }] }, 'roster-conflict'],
      [
        'missing column D',
        { sheets: [{ ...report, properties: { ...report.properties, gridProperties: { rowCount: 40, columnCount: 3 } } }] },
        'roster-conflict',
      ],
    ])('returns a conflict without writing for %s', (_name, metadata, outcome) => {
      const next = vi.fn();
      service.syncCategorySpendingReport(SPREADSHEET_ID, true).subscribe(next);
      readMetadata().flush(metadata);
      expect(next).toHaveBeenCalledExactlyOnceWith(outcome);
    });

    it.each([true, false])('reads fresh metadata after a lost write response (committed: %s)', committed => {
      const next = vi.fn();
      const error = vi.fn();
      const attempt = service.syncCategorySpendingReport(SPREADSHEET_ID, true);
      attempt.subscribe({ next, error });
      readMetadata().flush({ sheets: personalTabs });
      writeReport().error(new ProgressEvent('error'));
      expect(error).toHaveBeenCalledOnce();
      expect(next).not.toHaveBeenCalled();
      attempt.subscribe(next);
      readMetadata().flush({ sheets: committed ? [...personalTabs, report] : personalTabs });
      const retry = writeReport();
      if (committed) {
        expect(retry.request.body.requests).toEqual([
          { updateCells: { range: rosterColumn, fields: 'userEnteredValue', rows: rosterRows } },
        ]);
      } else {
        expect(retry.request.body.requests[0].addSheet.properties.title).toBe('Overview');
      }
      retry.flush({});
      expect(next).toHaveBeenCalledExactlyOnceWith('ready');
    });

    it('reports a conflict on retry when another editor has claimed the title', () => {
      const next = vi.fn();
      const error = vi.fn();
      const attempt = service.syncCategorySpendingReport(SPREADSHEET_ID, true);
      attempt.subscribe({ error });
      readMetadata().flush({});
      writeReport().flush('Title already exists', { status: 400, statusText: 'Bad Request' });
      expect(error).toHaveBeenCalledOnce();
      attempt.subscribe(next);
      readMetadata().flush({ sheets: [{ properties: { title: 'Overview' } }] });
      expect(next).toHaveBeenCalledExactlyOnceWith('title-conflict');
    });
  });

  describe('addExpense() column E (in-debt flag)', () => {
    it('[AC1] writes numberValue: expense.amount into the column-E cell when isInDebt is true', () => {
      const expense: Expense = { ...baseExpense, isInDebt: true };

      service.addExpense(SHEET_ID, expense).subscribe();

      const req = httpMock.expectOne(request => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const updateCellsRequest = req.request.body.requests[1].updateCells;
      const columnECell = updateCellsRequest.rows[0].values[4];

      expect(columnECell.userEnteredValue).toEqual({ numberValue: expense.amount });

      req.flush({});
    });

    it('[AC2] writes no value into the column-E cell when isInDebt is false (and does not write 0)', () => {
      const expense: Expense = { ...baseExpense, isInDebt: false };

      service.addExpense(SHEET_ID, expense).subscribe();

      const req = httpMock.expectOne(request => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const updateCellsRequest = req.request.body.requests[1].updateCells;
      const columnECell = updateCellsRequest.rows[0].values[4];

      expect(columnECell.userEnteredValue).toBeUndefined();
      expect(columnECell.userEnteredValue).not.toEqual({ numberValue: 0 });

      req.flush({});
    });

    it('[AC2] writes no value into the column-E cell when isInDebt is undefined (and does not write 0)', () => {
      const expense: Expense = { ...baseExpense, isInDebt: undefined };

      service.addExpense(SHEET_ID, expense).subscribe();

      const req = httpMock.expectOne(request => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const updateCellsRequest = req.request.body.requests[1].updateCells;
      const columnECell = updateCellsRequest.rows[0].values[4];

      expect(columnECell.userEnteredValue).toBeUndefined();
      expect(columnECell.userEnteredValue).not.toEqual({ numberValue: 0 });

      req.flush({});
    });
  });

  describe('loadLastExpenses() column E read-back', () => {
    it('[AC3] requests range A1:E{take} and maps a populated column-E cell to a truthy isInDebt', () => {
      const take = 5;
      let result: Array<Expense> = [];

      service.loadLastExpenses(SHEET_NAME, take).subscribe(expenses => (result = expenses));

      const req = httpMock.expectOne(request => request.method === 'GET' && request.url.includes('/values/'));
      expect(decodeURIComponent(req.request.url)).toContain(`${SHEET_NAME}!A1:E${take}`);

      req.flush({ values: [['Food', 'lunch', 12.5, 45000, 12.5]] });

      expect(result[0].isInDebt).toBeTruthy();
    });

    it('[AC4] a row with a missing 5th cell maps to a falsy isInDebt and throws nothing', () => {
      let result: Array<Expense> = [];
      let thrown: unknown;

      service.loadLastExpenses(SHEET_NAME, 1).subscribe({
        next: expenses => (result = expenses),
        error: err => (thrown = err),
      });

      const req = httpMock.expectOne(request => request.method === 'GET' && request.url.includes('/values/'));
      // Historical row: only 4 values, no 5th (column E) value at all.
      req.flush({ values: [['Food', 'lunch', 12.5, 45000]] });

      expect(thrown).toBeUndefined();
      expect(result[0].isInDebt).toBeFalsy();
    });
  });

  describe('addExpense() / loadLastExpenses() date serial number round-trip', () => {
    it('round-trips a local date through getSerialNumberFromDate and getDateFromSerialNumber', () => {
      const expense: Expense = { ...baseExpense, date: new Date(2024, 0, 16, 12, 14, 23) };

      service.addExpense(SHEET_ID, expense).subscribe();

      const addReq = httpMock.expectOne(request => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const serialNumber = addReq.request.body.requests[1].updateCells.rows[0].values[3].userEnteredValue.numberValue;
      addReq.flush({});

      expect(serialNumber).toBeDefined();

      let result: Array<Expense> = [];
      service.loadLastExpenses(SHEET_NAME, 1).subscribe(expenses => (result = expenses));

      const getReq = httpMock.expectOne(request => request.method === 'GET' && request.url.includes('/values/'));
      getReq.flush({ values: [['Food', 'lunch', 12.5, serialNumber]] });

      const decoded = result[0].date!;
      expect(decoded.getFullYear()).toBe(2024);
      expect(decoded.getMonth()).toBe(0);
      expect(decoded.getDate()).toBe(16);
      expect(decoded.getHours()).toBe(12);
      expect(decoded.getMinutes()).toBe(14);
      expect(decoded.getSeconds()).toBe(23);
    });
  });

  describe('getDateFromSerialNumber DST regression (uses target instant offset, not "now" offset)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('decodes a winter date correctly even when "now" is in a summer DST offset', () => {
      // "Now" is mocked into summer (Kiev: UTC+3 / -180 minutes), while the encoded date
      // itself is in winter (Kiev: UTC+2 / -120 minutes). The old buggy decoder used
      // `new Date().getTimezoneOffset()` (the mocked summer "now"), shifting the decoded
      // winter date by the 1-hour DST delta. The fixed decoder derives the offset from the
      // target instant itself, so this must decode back to exactly 10:30, not 09:30.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 15, 8, 0, 0));

      const winterDate = new Date(2026, 0, 15, 10, 30, 0);
      const expense: Expense = { ...baseExpense, date: winterDate };

      service.addExpense(SHEET_ID, expense).subscribe();

      const addReq = httpMock.expectOne(request => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const serialNumber = addReq.request.body.requests[1].updateCells.rows[0].values[3].userEnteredValue.numberValue;
      addReq.flush({});

      let result: Array<Expense> = [];
      service.loadLastExpenses(SHEET_NAME, 1).subscribe(expenses => (result = expenses));

      const getReq = httpMock.expectOne(request => request.method === 'GET' && request.url.includes('/values/'));
      getReq.flush({ values: [['Food', 'lunch', 12.5, serialNumber]] });

      const decoded = result[0].date!;
      expect(decoded.getFullYear()).toBe(2026);
      expect(decoded.getMonth()).toBe(0);
      expect(decoded.getDate()).toBe(15);
      expect(decoded.getHours()).toBe(10);
      expect(decoded.getMinutes()).toBe(30);
    });
  });

  describe('loadExpenses() column E read-back', () => {
    function flushGviz(httpMockInstance: HttpTestingController, rowsC: Array<Array<{ v: unknown }>>): void {
      const req = httpMockInstance.expectOne(request => request.url.includes('/gviz/tq'));
      expect(req.request.params.get('tq')).toContain('select A, B, C, D, E');

      const dto = {
        table: {
          cols: [],
          rows: rowsC.map(c => ({ c })),
        },
      };
      req.flush(`/*O_o*/google.visualization.Query.setResponse(${JSON.stringify(dto)});`);
    }

    it('[AC3] gviz query selects column E and maps a populated column-E cell to a truthy isInDebt', () => {
      let result: Array<Expense> = [];

      service.loadExpenses({ sheetId: SHEET_ID }).subscribe(expenses => (result = expenses));

      flushGviz(httpMock, [[{ v: 'Food' }, { v: 'lunch' }, { v: 12.5 }, { v: 'Date(2024,0,16,12,14,23)' }, { v: 12.5 }]]);

      expect(result[0].isInDebt).toBeTruthy();
    });

    it('[AC4] a row without c[4] (missing 5th cell) maps to a falsy isInDebt and throws nothing', () => {
      let result: Array<Expense> = [];
      let thrown: unknown;

      service.loadExpenses({ sheetId: SHEET_ID }).subscribe({
        next: expenses => (result = expenses),
        error: err => (thrown = err),
      });

      // Historical row: c array has only 4 entries, no c[4] at all.
      flushGviz(httpMock, [[{ v: 'Food' }, { v: 'lunch' }, { v: 12.5 }, { v: 'Date(2024,0,16,12,14,23)' }]]);

      expect(thrown).toBeUndefined();
      expect(result[0].isInDebt).toBeFalsy();
    });

    it('a blank column-D (date) cell maps to an undefined date and throws nothing', () => {
      let result: Array<Expense> = [];
      let thrown: unknown;

      service.loadExpenses({ sheetId: SHEET_ID }).subscribe({
        next: expenses => (result = expenses),
        error: err => (thrown = err),
      });

      // gviz represents a blank cell as `null` in the `c` array, not `{v: null}` -- same shape
      // as the already-fixed blank category/amount cells, but column D (date) was missed.
      flushGviz(httpMock, [[{ v: 'Food' }, { v: 'lunch' }, { v: 12.5 }, null as unknown as { v: unknown }]]);

      expect(thrown).toBeUndefined();
      expect(result[0].date).toBeUndefined();
    });
  });

  describe('deleteSheetRow() — sheet-row index arithmetic', () => {
    it('should_send_deleteDimension_request_with_startIndex_0_endIndex_1_for_index_0', () => {
      service.deleteSheetRow(SHEET_ID, 0).subscribe();

      const req = httpMock.expectOne(request => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const deleteDimension = req.request.body.requests[0].deleteDimension;

      expect(deleteDimension).toEqual({
        range: { sheetId: SHEET_ID, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      });

      req.flush({});
    });

    it('should_send_deleteDimension_request_with_correct_start_and_end_index_for_a_mid_range_index', () => {
      service.deleteSheetRow(SHEET_ID, 17).subscribe();

      const req = httpMock.expectOne(request => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const deleteDimension = req.request.body.requests[0].deleteDimension;

      expect(deleteDimension.range.startIndex).toBe(17);
      expect(deleteDimension.range.endIndex).toBe(18);
      expect(deleteDimension.range.dimension).toBe('ROWS');

      req.flush({});
    });

    it('should_thread_the_given_sheetId_into_the_deleteDimension_range_rather_than_a_hardcoded_one', () => {
      const otherSheetId = 12345;

      service.deleteSheetRow(otherSheetId, 3).subscribe();

      const req = httpMock.expectOne(request => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const deleteDimension = req.request.body.requests[0].deleteDimension;

      expect(deleteDimension.range.sheetId).toBe(otherSheetId);

      req.flush({});
    });
  });

  describe('updateCategories() — range and value mapping', () => {
    it('should_PUT_to_the_A1_B_N_range_where_N_is_categories_length', () => {
      const categories: Array<Category> = [
        { name: 'Food', id: 0 },
        { name: 'Transport', id: 1 },
        { name: 'Bills', id: 2 },
      ];

      service.updateCategories(categories).subscribe();

      const req = httpMock.expectOne(request => request.method === 'PUT' && request.url.includes('/values/'));
      expect(decodeURIComponent(req.request.url)).toContain(`${CATEGORIES_SHEET_TITLE}!A1:B${categories.length}`);

      req.flush({});
    });

    it('should_map_each_category_to_a_name_id_row_pair_in_the_given_order', () => {
      const categories: Array<Category> = [
        { name: 'Food', id: 0 },
        { name: 'Transport', id: 1 },
      ];

      service.updateCategories(categories).subscribe();

      const req = httpMock.expectOne(request => request.method === 'PUT' && request.url.includes('/values/'));
      expect(req.request.body.values).toEqual([
        ['Food', 0],
        ['Transport', 1],
      ]);

      req.flush({});
    });

    it('should_use_a_range_length_that_tracks_a_single_category_list_not_a_stale_count', () => {
      const categories: Array<Category> = [{ name: 'OnlyOne', id: 0 }];

      service.updateCategories(categories).subscribe();

      const req = httpMock.expectOne(request => request.method === 'PUT' && request.url.includes('/values/'));
      expect(decodeURIComponent(req.request.url)).toContain(`${CATEGORIES_SHEET_TITLE}!A1:B1`);
      expect(req.request.body.values).toEqual([['OnlyOne', 0]]);

      req.flush({});
    });
  });
});
