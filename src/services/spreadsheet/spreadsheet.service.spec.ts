import { TestBed } from '@angular/core/testing';

import { SpreadsheetService } from './spreadsheet.service';

xdescribe('SpreadsheetService', () => {
  let service: SpreadsheetService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SpreadsheetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
