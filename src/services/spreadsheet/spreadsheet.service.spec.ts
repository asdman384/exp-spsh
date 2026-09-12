import { provideHttpClient } from '@angular/common/http';
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
    date: new Date(2024, 0, 16, 12, 14, 23)
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
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

  describe('addExpense() column E (in-debt flag)', () => {
    it('[AC1] writes numberValue: expense.amount into the column-E cell when isInDebt is true', () => {
      const expense: Expense = { ...baseExpense, isInDebt: true };

      service.addExpense(SHEET_ID, expense).subscribe();

      const req = httpMock.expectOne(
        (request) => request.method === 'POST' && request.url.endsWith(':batchUpdate')
      );
      const updateCellsRequest = req.request.body.requests[1].updateCells;
      const columnECell = updateCellsRequest.rows[0].values[4];

      expect(columnECell.userEnteredValue).toEqual({ numberValue: expense.amount });

      req.flush({});
    });

    it('[AC2] writes no value into the column-E cell when isInDebt is false (and does not write 0)', () => {
      const expense: Expense = { ...baseExpense, isInDebt: false };

      service.addExpense(SHEET_ID, expense).subscribe();

      const req = httpMock.expectOne(
        (request) => request.method === 'POST' && request.url.endsWith(':batchUpdate')
      );
      const updateCellsRequest = req.request.body.requests[1].updateCells;
      const columnECell = updateCellsRequest.rows[0].values[4];

      expect(columnECell.userEnteredValue).toBeUndefined();
      expect(columnECell.userEnteredValue).not.toEqual({ numberValue: 0 });

      req.flush({});
    });

    it('[AC2] writes no value into the column-E cell when isInDebt is undefined (and does not write 0)', () => {
      const expense: Expense = { ...baseExpense, isInDebt: undefined };

      service.addExpense(SHEET_ID, expense).subscribe();

      const req = httpMock.expectOne(
        (request) => request.method === 'POST' && request.url.endsWith(':batchUpdate')
      );
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

      service.loadLastExpenses(SHEET_NAME, take).subscribe((expenses) => (result = expenses));

      const req = httpMock.expectOne((request) => request.method === 'GET' && request.url.includes('/values/'));
      expect(decodeURIComponent(req.request.url)).toContain(`${SHEET_NAME}!A1:E${take}`);

      req.flush({ values: [['Food', 'lunch', 12.5, 45000, 12.5]] });

      expect(result[0].isInDebt).toBeTruthy();
    });

    it('[AC4] a row with a missing 5th cell maps to a falsy isInDebt and throws nothing', () => {
      let result: Array<Expense> = [];
      let thrown: unknown;

      service.loadLastExpenses(SHEET_NAME, 1).subscribe({
        next: (expenses) => (result = expenses),
        error: (err) => (thrown = err)
      });

      const req = httpMock.expectOne((request) => request.method === 'GET' && request.url.includes('/values/'));
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

      const addReq = httpMock.expectOne(
        (request) => request.method === 'POST' && request.url.endsWith(':batchUpdate')
      );
      const serialNumber = addReq.request.body.requests[1].updateCells.rows[0].values[3].userEnteredValue.numberValue;
      addReq.flush({});

      expect(serialNumber).toBeDefined();

      let result: Array<Expense> = [];
      service.loadLastExpenses(SHEET_NAME, 1).subscribe((expenses) => (result = expenses));

      const getReq = httpMock.expectOne((request) => request.method === 'GET' && request.url.includes('/values/'));
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

      const addReq = httpMock.expectOne(
        (request) => request.method === 'POST' && request.url.endsWith(':batchUpdate')
      );
      const serialNumber = addReq.request.body.requests[1].updateCells.rows[0].values[3].userEnteredValue.numberValue;
      addReq.flush({});

      let result: Array<Expense> = [];
      service.loadLastExpenses(SHEET_NAME, 1).subscribe((expenses) => (result = expenses));

      const getReq = httpMock.expectOne((request) => request.method === 'GET' && request.url.includes('/values/'));
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
      const req = httpMockInstance.expectOne((request) => request.url.includes('/gviz/tq'));
      expect(req.request.params.get('tq')).toContain('select A, B, C, D, E');

      const dto = {
        table: {
          cols: [],
          rows: rowsC.map((c) => ({ c }))
        }
      };
      req.flush(`/*O_o*/google.visualization.Query.setResponse(${JSON.stringify(dto)});`);
    }

    it('[AC3] gviz query selects column E and maps a populated column-E cell to a truthy isInDebt', () => {
      let result: Array<Expense> = [];

      service.loadExpenses({ sheetId: SHEET_ID }).subscribe((expenses) => (result = expenses));

      flushGviz(httpMock, [
        [{ v: 'Food' }, { v: 'lunch' }, { v: 12.5 }, { v: 'Date(2024,0,16,12,14,23)' }, { v: 12.5 }]
      ]);

      expect(result[0].isInDebt).toBeTruthy();
    });

    it('[AC4] a row without c[4] (missing 5th cell) maps to a falsy isInDebt and throws nothing', () => {
      let result: Array<Expense> = [];
      let thrown: unknown;

      service.loadExpenses({ sheetId: SHEET_ID }).subscribe({
        next: (expenses) => (result = expenses),
        error: (err) => (thrown = err)
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
        next: (expenses) => (result = expenses),
        error: (err) => (thrown = err)
      });

      // gviz represents a blank cell as `null` in the `c` array, not `{v: null}` -- same shape
      // as the already-fixed blank category/amount cells, but column D (date) was missed.
      flushGviz(httpMock, [
        [{ v: 'Food' }, { v: 'lunch' }, { v: 12.5 }, null as unknown as { v: unknown }]
      ]);

      expect(thrown).toBeUndefined();
      expect(result[0].date).toBeUndefined();
    });
  });

  describe('deleteSheetRow() — sheet-row index arithmetic', () => {
    it('should_send_deleteDimension_request_with_startIndex_0_endIndex_1_for_index_0', () => {
      service.deleteSheetRow(SHEET_ID, 0).subscribe();

      const req = httpMock.expectOne((request) => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const deleteDimension = req.request.body.requests[0].deleteDimension;

      expect(deleteDimension).toEqual({
        range: { sheetId: SHEET_ID, dimension: 'ROWS', startIndex: 0, endIndex: 1 }
      });

      req.flush({});
    });

    it('should_send_deleteDimension_request_with_correct_start_and_end_index_for_a_mid_range_index', () => {
      service.deleteSheetRow(SHEET_ID, 17).subscribe();

      const req = httpMock.expectOne((request) => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
      const deleteDimension = req.request.body.requests[0].deleteDimension;

      expect(deleteDimension.range.startIndex).toBe(17);
      expect(deleteDimension.range.endIndex).toBe(18);
      expect(deleteDimension.range.dimension).toBe('ROWS');

      req.flush({});
    });

    it('should_thread_the_given_sheetId_into_the_deleteDimension_range_rather_than_a_hardcoded_one', () => {
      const otherSheetId = 12345;

      service.deleteSheetRow(otherSheetId, 3).subscribe();

      const req = httpMock.expectOne((request) => request.method === 'POST' && request.url.endsWith(':batchUpdate'));
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
        { name: 'Bills', id: 2 }
      ];

      service.updateCategories(categories).subscribe();

      const req = httpMock.expectOne((request) => request.method === 'PUT' && request.url.includes('/values/'));
      expect(decodeURIComponent(req.request.url)).toContain(`${CATEGORIES_SHEET_TITLE}!A1:B${categories.length}`);

      req.flush({});
    });

    it('should_map_each_category_to_a_name_id_row_pair_in_the_given_order', () => {
      const categories: Array<Category> = [
        { name: 'Food', id: 0 },
        { name: 'Transport', id: 1 }
      ];

      service.updateCategories(categories).subscribe();

      const req = httpMock.expectOne((request) => request.method === 'PUT' && request.url.includes('/values/'));
      expect(req.request.body.values).toEqual([
        ['Food', 0],
        ['Transport', 1]
      ]);

      req.flush({});
    });

    it('should_use_a_range_length_that_tracks_a_single_category_list_not_a_stale_count', () => {
      const categories: Array<Category> = [{ name: 'OnlyOne', id: 0 }];

      service.updateCategories(categories).subscribe();

      const req = httpMock.expectOne((request) => request.method === 'PUT' && request.url.includes('/values/'));
      expect(decodeURIComponent(req.request.url)).toContain(`${CATEGORIES_SHEET_TITLE}!A1:B1`);
      expect(req.request.body.values).toEqual([['OnlyOne', 0]]);

      req.flush({});
    });
  });
});
