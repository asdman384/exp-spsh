import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { NetworkStatusService, SpreadsheetService } from 'src/services';
import { Expense } from 'src/shared/models';
import { Store } from '@ngrx/store';
import { StatisticsDataService } from './statistics-data.service';

describe('StatisticsDataService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('includes a saved November 25 expense when the local date is November 22', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 10, 22, 12));
      const october = { category: 'Food', date: new Date(2026, 9, 31), amount: 10 };
      const november = { category: 'Food', date: new Date(2026, 10, 25), amount: 25 };
      const loadExpenses = vi.fn(() => of([october, november]));
      TestBed.configureTestingModule({
        providers: [
          StatisticsDataService,
          provideMockStore(),
          { provide: SpreadsheetService, useValue: { loadExpenses } },
          { provide: NetworkStatusService, useValue: { online$: of(true) } },
        ],
      });
      const service = TestBed.inject(StatisticsDataService);
      const today = new Date();
      service.load(1, today.getFullYear(), today.getMonth());
      expect(loadExpenses).toHaveBeenCalledWith({ sheetId: 1, from: new Date(2026, 9, 1), to: new Date(2026, 11, 1) });
      expect(service.state()).toEqual({ status: 'ready', current: [november], previous: [october] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears failed data, reports the failure, and reloads after reconnect', () => {
    vi.stubGlobal('log', vi.fn());
    const online$ = new BehaviorSubject(true);
    const response = new Subject<Expense[]>();
    const nextResponse = new Subject<Expense[]>();
    const loadExpenses = vi.fn().mockReturnValueOnce(response).mockReturnValue(nextResponse);
    TestBed.configureTestingModule({
      providers: [
        StatisticsDataService,
        provideMockStore(),
        { provide: SpreadsheetService, useValue: { loadExpenses } },
        { provide: NetworkStatusService, useValue: { online$ } },
      ],
    });
    const dispatch = vi.spyOn(TestBed.inject(Store), 'dispatch');
    const service = TestBed.inject(StatisticsDataService);
    service.load(1, 2026, 0);
    response.error(new Error('Unavailable'));
    expect(service.state()).toEqual({ status: 'error', current: [], previous: [] });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ source: 'loadExpenses$' }));
    online$.next(false);
    expect(service.state().status).toBe('loading');
    expect(loadExpenses).toHaveBeenCalledTimes(1);
    online$.next(true);
    nextResponse.next([]);
    expect(service.state()).toEqual({ status: 'ready', current: [], previous: [] });
    TestBed.resetTestingModule();
    expect(nextResponse.observed).toBe(false);
  });

  it('loads January with December and discards a response for an older selection', () => {
    const requests: Subject<Expense[]>[] = [];
    const loadExpenses = vi.fn(() => {
      const result = new Subject<Expense[]>();
      requests.push(result);
      return result;
    });
    TestBed.configureTestingModule({
      providers: [
        StatisticsDataService,
        provideMockStore(),
        { provide: SpreadsheetService, useValue: { loadExpenses } },
        { provide: NetworkStatusService, useValue: { online$: new BehaviorSubject(true) } },
      ],
    });
    const service = TestBed.inject(StatisticsDataService);
    service.load(1, 2026, 0);
    expect(loadExpenses).toHaveBeenLastCalledWith({
      sheetId: 1,
      from: new Date(2025, 11, 1),
      to: new Date(2026, 1, 1),
    });
    service.load(2, 2026, 1);
    requests[0].next([{ category: 'Old', date: new Date(2026, 0, 1), amount: 50 }]);
    expect(service.state().status).toBe('loading');
    const previous = { category: 'Food', date: new Date(2026, 0, 31), amount: 20 };
    const current = { category: 'Food', date: new Date(2026, 1, 1), amount: 30 };
    requests[1].next([previous, current]);
    expect(service.state()).toEqual({ status: 'ready', current: [current], previous: [previous] });
    service.load(1, 2026, 2);
    expect(service.state()).toEqual({ status: 'loading', current: [], previous: [] });
  });
});
