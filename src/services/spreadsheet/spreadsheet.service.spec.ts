import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Expense } from 'src/shared/models';

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
  });
});
