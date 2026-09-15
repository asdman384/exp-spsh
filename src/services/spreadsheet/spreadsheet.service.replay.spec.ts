import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Expense } from 'src/shared/models';

import { SpreadsheetService } from './spreadsheet.service';

// [AC13] getSpreadsheetId() is a read-only accessor over the private field.
describe('[AC13] SpreadsheetService.getSpreadsheetId', () => {
  let service: SpreadsheetService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withXhr()), provideHttpClientTesting()] });
    service = TestBed.inject(SpreadsheetService);
  });

  it('should_return_an_empty_string_before_any_setSpreadsheetId_call', () => {
    expect(service.getSpreadsheetId()).toBe('');
  });

  it('should_return_the_value_passed_to_setSpreadsheetId', () => {
    service.setSpreadsheetId('outbox-replay-spreadsheet');
    expect(service.getSpreadsheetId()).toBe('outbox-replay-spreadsheet');
  });
});

// [AC14] A replayed addExpense (the five-key trim of a form value, cloned) must be byte-identical
// to the live call it stands in for: same method, same urlWithParams, same JSON body.
describe('[AC14] SpreadsheetService.addExpense replay is byte-identical to the live call', () => {
  let service: SpreadsheetService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withXhr()), provideHttpClientTesting()] });
    service = TestBed.inject(SpreadsheetService);
    httpMock = TestBed.inject(HttpTestingController);
    service.setSpreadsheetId('replay-spreadsheet-id');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should_send_the_same_method_urlWithParams_and_JSON_body_for_a_live_form_value_and_its_replayed_five_key_trim', () => {
    const sheetId = 7;

    // The dashboard form value carries an extra `sheet` object the outbox never persists (D10),
    // alongside a real Date instance.
    const formValue = {
      date: new Date(2024, 3, 5, 9, 30, 0),
      amount: 42.5,
      category: 'Food',
      comment: 'lunch',
      isInDebt: true,
      sheet: { id: sheetId, title: 'Sheet1' }
    } as Expense & { sheet: { id: number; title: string } };

    service.addExpense(sheetId, formValue).subscribe();
    const liveReq = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(':batchUpdate'));
    liveReq.flush({});

    const { date, amount, category, comment, isInDebt } = formValue;
    const replayed: Expense = structuredClone({ date, amount, category, comment, isInDebt });

    service.addExpense(sheetId, replayed).subscribe();
    const replayReq = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(':batchUpdate'));
    replayReq.flush({});

    expect(replayReq.request.method).toBe(liveReq.request.method);
    expect(replayReq.request.urlWithParams).toBe(liveReq.request.urlWithParams);
    expect(JSON.stringify(replayReq.request.body)).toBe(JSON.stringify(liveReq.request.body));
  });
});
