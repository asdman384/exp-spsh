import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';
import { AppActions } from 'src/@state';
import { FAILURE_MESSAGES } from 'src/@state/report-failure';
import { NetworkStatusService, SpreadsheetService } from 'src/services';
import { Expense } from 'src/shared/models';

interface MonthSelection { sheetId: number; year: number; month: number }
interface MonthData {
  status: 'loading' | 'ready' | 'error';
  current: Expense[];
  previous: Expense[];
}
const LOADING: MonthData = { status: 'loading', current: [], previous: [] };

/** Page-scoped data: one range request keeps both months in the same snapshot. */
@Injectable()
export class StatisticsDataService {
  private readonly spreadsheet = inject(SpreadsheetService);
  private readonly network = inject(NetworkStatusService);
  private readonly store = inject(Store);
  private readonly selection = new Subject<MonthSelection>();

  readonly state = toSignal(this.selection.pipe(
    switchMap((selection) => this.network.online$.pipe(
      switchMap((online) => online ? this.read(selection) : of(LOADING))
    ))
  ), { initialValue: LOADING });

  load(sheetId: number, year: number, month: number): void {
    this.selection.next({ sheetId, year, month });
  }

  private read({ sheetId, year, month }: MonthSelection) {
    const boundary = new Date(year, month, 1).getTime();
    return this.spreadsheet.loadExpenses({
      sheetId, from: new Date(year, month - 1, 1), to: new Date(year, month + 1, 1)
    }).pipe(
      map((rows): MonthData => ({
        status: 'ready',
        current: rows.filter((row) => row.date !== undefined && row.date.getTime() >= boundary),
        previous: rows.filter((row) => row.date !== undefined && row.date.getTime() < boundary)
      })),
      catchError((error: unknown) => {
        log(error);
        this.store.dispatch(AppActions.operationFailed({
          source: 'loadExpenses$', message: FAILURE_MESSAGES.loadExpenses$
        }));
        return of<MonthData>({ status: 'error', current: [], previous: [] });
      }),
      startWith(LOADING)
    );
  }
}
