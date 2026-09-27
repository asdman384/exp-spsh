import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { EMPTY, Subject, catchError, exhaustMap, filter, map, switchMap, tap } from 'rxjs';

import { AppActions } from 'src/@state';
import { FAILURE_MESSAGES, reportFailure } from 'src/@state/report-failure';
import { ROUTE } from 'src/constants';
import { NetworkStatusService, OutboxService, SpreadsheetService } from 'src/services';
import { isExpenseEqual } from 'src/shared/helpers';
import { Expense, Sheet } from 'src/shared/models';

export interface ExpensesFilter {
  sheetId: number;
  from?: Date;
  to?: Date;
}

/**
 * Owns the list of expenses shown on the dashboard and the statistics page. The list lives in a
 * signal, not in the NgRx store. Every new expense goes through the write outbox; the list is
 * reloaded once the outbox has sent it.
 */
@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly store = inject(Store);
  private readonly spreadsheet = inject(SpreadsheetService);
  private readonly status = inject(NetworkStatusService);
  private readonly router = inject(Router);
  private readonly outbox = inject(OutboxService);

  private readonly state = signal<Array<Expense>>([]);
  readonly expenses = this.state.asReadonly();

  private readonly load$ = new Subject<ExpensesFilter>();
  private readonly delete$ = new Subject<{ sheet: Sheet; expense: Expense }>();

  constructor() {
    this.load$
      .pipe(
        // Waits for the network, and reloads the last filter when the connection comes back.
        switchMap((request) => this.status.online$.pipe(filter(Boolean), map(() => request))),
        exhaustMap((request) => {
          this.store.dispatch(AppActions.loading({ loading: true }));
          return this.spreadsheet.loadExpenses(request).pipe(
            tap((expenses) => {
              this.state.set(expenses);
              this.store.dispatch(AppActions.loading({ loading: false }));
            }),
            catchError(reportFailure('loadExpenses$', this.store))
          );
        })
      )
      .subscribe();

    this.delete$.pipe(exhaustMap(({ sheet, expense }) => this.deleteRemote(sheet, expense))).subscribe();

    this.outbox.sent$
      .pipe(filter(() => this.isOnDashboard()))
      .subscribe(({ payload }) => this.load(dayWindow(payload.sheetId, payload.expense.date!)));
  }

  load(request: ExpensesFilter): void {
    log('ExpensesService::load', request);
    this.load$.next(request);
  }

  /** Queues the expense in the outbox; the outbox sends it when the spreadsheet is reachable. */
  add(sheetId: number, expense: Expense): void {
    this.outbox.add(sheetId, expense);
  }

  /** Removes the row from the list at once and puts it back if the spreadsheet delete fails. */
  delete(sheet: Sheet, expense: Expense): void {
    log('ExpensesService::delete', sheet, expense);
    this.delete$.next({ sheet, expense });
  }

  private deleteRemote(sheet: Sheet, expense: Expense) {
    const index = this.state().findIndex((e) => isExpenseEqual(e, expense));
    const backup = ~index ? { expense: this.state()[index], index } : null;
    if (backup) {
      this.state.update((expenses) => expenses.filter((_, i) => i !== index));
    }

    this.store.dispatch(AppActions.loading({ loading: true }));
    return this.spreadsheet.loadLastExpenses(sheet.title, 100).pipe(
      switchMap((expenses) => {
        const i = expenses.findIndex((e) => isExpenseEqual(e, expense));
        if (!~i) {
          throw `cannot find expense in the last 100 rows`;
        }
        return this.spreadsheet.deleteSheetRow(sheet.id, i);
      }),
      tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
      catchError((e) => {
        log(e);
        if (backup && !this.state().some((x) => isExpenseEqual(x, backup.expense))) {
          this.state.update((expenses) => {
            const restored = [...expenses];
            restored.splice(Math.min(backup.index, restored.length), 0, backup.expense);
            return restored;
          });
        }
        this.store.dispatch(AppActions.loading({ loading: false }));
        this.store.dispatch(
          AppActions.operationFailed({ source: 'deleteExpense$', message: FAILURE_MESSAGES.deleteExpense$ })
        );
        return EMPTY;
      })
    );
  }

  private isOnDashboard(): boolean {
    const [path] = this.router.url.split('?');
    return path.split(';')[0] === `/${ROUTE.dashboard}`;
  }
}

/** The one-day window starting at `from`. */
function dayWindow(sheetId: number, from: Date): ExpensesFilter {
  const to = new Date(from);
  to.setDate(to.getDate() + 1); // add a day
  return { sheetId, from, to };
}
