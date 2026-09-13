import { Injectable, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router } from '@angular/router';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concatMap,
  filter,
  finalize,
  firstValueFrom,
  from,
  map,
  merge,
  pairwise,
  take,
  tap
} from 'rxjs';

import { ROUTE } from 'src/constants';
import {
  AbstractSecurityService,
  NetworkStatusService,
  OutboxDrainLock,
  OutboxStorage,
  SpreadsheetService
} from 'src/services';
import { classifyWriteError, toMessage } from 'src/shared/helpers';
import { OutboxRecord } from 'src/shared/models';
import { OutboxFailureNoticeComponent } from 'src/shared/components/outbox-failure-notice/outbox-failure-notice.component';

import { AppActions } from './app.actions';
import { OUTBOX_MESSAGES } from './outbox-messages';
import { OutboxActions } from './outbox.actions';
import { oldestFailedSelector } from './outbox.selectors';
import { reportFailure } from './report-failure';

/**
 * Owns everything remote for the write outbox (`docs/specs/write-outbox.md` D4, D6-D8, D12-D15):
 * boot hydration, the persist-first enqueue, the drain loop and its triggers/preconditions, and
 * the Retry/Discard reactions to the failure notice. `AppEffects.addExpense$` only decides
 * whether to route into the queue; everything after that lives here.
 */
@Injectable()
export class OutboxEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly status = inject(NetworkStatusService);
  private readonly security = inject(AbstractSecurityService);
  private readonly spreadSheetService = inject(SpreadsheetService);
  private readonly storage = inject(OutboxStorage);
  private readonly lock = inject(OutboxDrainLock);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  // P1 (D7): set once boot hydration has completed successfully. Never reset.
  private hydrationDone = false;
  // T1 (D6): fired once, by hydrateOnInit$, on a successful boot hydration.
  private readonly bootHydrated$ = new Subject<void>();

  // Single-flight + coalesced rerun (D6): at most one pass runs; a trigger during a pass sets
  // `rerunRequested`, and exactly one more pass runs once the current one ends.
  private running = false;
  private rerunRequested = false;

  // D8's extra guard: an id whose send succeeded this session is never sent again, even if its
  // `remove` failed.
  private readonly sessionSent = new Set<string>();

  // D3's auth-toast edge trigger, following the `categoriesBackUp` / `deletedExpenseBackup`
  // precedent: true while the most recent stop was an auth stop with no successful send since.
  private authStopActive = false;

  private readonly onlineRisingEdge$ = this.status.online$.pipe(
    pairwise(),
    filter(([wasOnline, isOnline]) => !wasOnline && isOnline),
    map(() => undefined)
  );

  private readonly navigationEnd$ = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map(() => undefined)
  );

  private readonly triggers$ = merge(
    this.bootHydrated$, // T1
    this.onlineRisingEdge$, // T2
    this.navigationEnd$, // T3
    this.actions$.pipe(ofType(OutboxActions.drainRequested), map(() => undefined)), // T4
    this.actions$.pipe(ofType(OutboxActions.syncRequested), map(() => undefined)) // T5
  );

  readonly hydrateOnInit$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ROOT_EFFECTS_INIT),
        tap(log),
        concatMap(() => {
          if (!this.storage.isAvailable()) {
            return EMPTY;
          }
          return this.storage.getAll().pipe(
            tap((records) => {
              this.store.dispatch(OutboxActions.hydrated({ records }));
              this.hydrationDone = true;
              this.bootHydrated$.next();
            }),
            catchError((e: unknown) => {
              log(e);
              return EMPTY;
            })
          );
        })
      ),
    { dispatch: false }
  );

  readonly persistEnqueue$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OutboxActions.enqueue),
        tap(log),
        concatMap(({ record, drain }) =>
          this.storage.add(record).pipe(
            tap(() => {
              this.store.dispatch(OutboxActions.enqueued({ record }));
              if (drain) {
                this.store.dispatch(OutboxActions.drainRequested());
              }
              void this.liveAnnouncer.announce(OUTBOX_MESSAGES.queued, 'polite');
            }),
            catchError(reportFailure('addExpense$', this.store))
          )
        )
      ),
    { dispatch: false }
  );

  readonly drainOnTrigger$ = createEffect(
    () =>
      this.triggers$.pipe(
        tap(() => {
          log('OutboxEffects: drain trigger');
          this.scheduleRun();
        })
      ),
    { dispatch: false }
  );

  readonly retry$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OutboxActions.retry),
        tap(log),
        concatMap(({ localId }) =>
          this.storage.updateStatus(localId, { status: 'pending', failure: undefined }).pipe(
            concatMap(() => this.storage.getAll()),
            tap((records) => {
              this.store.dispatch(OutboxActions.hydrated({ records }));
              this.store.dispatch(OutboxActions.drainRequested());
            }),
            catchError((e: unknown) => {
              log(e);
              return EMPTY;
            })
          )
        )
      ),
    { dispatch: false }
  );

  readonly discard$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OutboxActions.discard),
        tap(log),
        concatMap(({ localId }) =>
          this.storage.remove(localId).pipe(
            concatMap(() => this.storage.getAll()),
            tap((records) => this.store.dispatch(OutboxActions.hydrated({ records }))),
            catchError((e: unknown) => {
              log(e);
              return EMPTY;
            })
          )
        )
      ),
    { dispatch: false }
  );

  readonly failureNoticeOnDrainCompleted$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OutboxActions.drainCompleted),
        filter(({ newlyFailed }) => newlyFailed > 0),
        concatMap(() => this.store.select(oldestFailedSelector).pipe(take(1))),
        filter((record): record is OutboxRecord => !!record),
        tap((record) => this.openFailureNotice(record))
      ),
    { dispatch: false }
  );

  readonly failureNoticeOnSyncRequested$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OutboxActions.syncRequested),
        concatMap(() => this.store.select(oldestFailedSelector).pipe(take(1))),
        filter((record): record is OutboxRecord => !!record),
        tap((record) => this.openFailureNotice(record))
      ),
    { dispatch: false }
  );

  readonly reloadOnDrainCompleted$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OutboxActions.drainCompleted),
      filter(
        (action): action is typeof action & { lastSent: OutboxRecord } => action.sent > 0 && !!action.lastSent
      ),
      filter(() => this.isOnDashboard()),
      map(({ lastSent }) => {
        const day = lastSent.payload.expense.date!;
        const to = new Date(day);
        to.setDate(to.getDate() + 1); // add a day
        return AppActions.loadExpenses({ sheetId: lastSent.payload.sheetId, from: day, to });
      })
    )
  );

  readonly announceAllSent$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OutboxActions.drainCompleted),
        filter(({ sent, remainingPending }) => sent > 0 && remainingPending === 0),
        tap(() => void this.liveAnnouncer.announce(OUTBOX_MESSAGES.allSent, 'polite'))
      ),
    { dispatch: false }
  );

  private scheduleRun(): void {
    if (this.running) {
      this.rerunRequested = true;
      return;
    }
    this.running = true;
    this.runPass$()
      .pipe(
        finalize(() => {
          this.running = false;
          if (this.rerunRequested) {
            this.rerunRequested = false;
            this.scheduleRun();
          }
        })
      )
      .subscribe();
  }

  private runPass$(): Observable<void> {
    return from(this.runPassAsync()).pipe(
      catchError((e: unknown) => {
        log(e);
        return EMPTY;
      })
    );
  }

  private async runPassAsync(): Promise<void> {
    if (!(await this.preconditionsMet())) {
      return;
    }
    await firstValueFrom(this.lock.run(() => from(this.runLockedPass())));
  }

  private async preconditionsMet(): Promise<boolean> {
    if (!this.hydrationDone) {
      log('OutboxEffects: precondition P1 (hydration) not met; skipping drain pass');
      return false;
    }
    const online = await firstValueFrom(this.status.online$.pipe(take(1)));
    if (!online) {
      log('OutboxEffects: precondition P2 (online) not met; skipping drain pass');
      return false;
    }
    const user = await firstValueFrom(this.security.user$.pipe(take(1)));
    if (!user) {
      log('OutboxEffects: precondition P3 (signed in) not met; skipping drain pass');
      return false;
    }
    if (!this.spreadSheetService.getSpreadsheetId()) {
      log('OutboxEffects: precondition P4 (spreadsheet id) not met; skipping drain pass');
      return false;
    }
    return true;
  }

  private async runLockedPass(): Promise<void> {
    const initial = await firstValueFrom(this.storage.getAll());
    this.store.dispatch(OutboxActions.hydrated({ records: initial }));

    let sent = 0;
    let newlyFailed = 0;
    let lastSent: OutboxRecord | null = null;
    let finalRecords = initial;

    while (true) {
      let fresh: Array<OutboxRecord>;
      try {
        fresh = await firstValueFrom(this.storage.getAll());
      } catch (e) {
        log(e);
        break;
      }
      finalRecords = fresh;

      const next = pickOldestPending(fresh);
      if (!next) {
        break;
      }

      if (this.sessionSent.has(next.localId)) {
        try {
          await firstValueFrom(this.storage.remove(next.localId));
        } catch (e) {
          log(e);
          break;
        }
        continue;
      }

      const online = await firstValueFrom(this.status.online$.pipe(take(1)));
      if (!online) {
        break;
      }

      if (next.spreadsheetId !== this.spreadSheetService.getSpreadsheetId()) {
        try {
          await firstValueFrom(
            this.storage.updateStatus(next.localId, { status: 'failed', failure: 'otherSpreadsheet' })
          );
        } catch (e) {
          log(e);
          break;
        }
        this.store.dispatch(
          OutboxActions.terminallyFailed({
            localId: next.localId,
            attempts: next.attempts,
            lastError: next.lastError ?? '',
            failure: 'otherSpreadsheet'
          })
        );
        newlyFailed++;
        continue;
      }

      this.store.dispatch(OutboxActions.attemptStarted({ localId: next.localId }));

      let outcome: 'success' | ReturnType<typeof classifyWriteError>;
      let sendError: unknown;
      try {
        await firstValueFrom(this.spreadSheetService.addExpense(next.payload.sheetId, next.payload.expense));
        outcome = 'success';
      } catch (e) {
        sendError = e;
        outcome = classifyWriteError(e);
      }

      if (outcome === 'success') {
        this.sessionSent.add(next.localId);
        try {
          await firstValueFrom(this.storage.remove(next.localId));
        } catch (e) {
          log(e);
        }
        this.store.dispatch(OutboxActions.succeeded({ localId: next.localId }));
        this.authStopActive = false;
        sent++;
        lastSent = next;
        continue;
      }

      const lastError = toMessage(sendError);

      if (outcome === 'retryable' || outcome === 'auth') {
        try {
          await firstValueFrom(
            this.storage.updateStatus(next.localId, {
              status: 'pending',
              attempts: next.attempts + 1,
              lastError
            })
          );
        } catch (e) {
          log(e);
          break;
        }
        this.store.dispatch(
          OutboxActions.retryableFailed({ localId: next.localId, attempts: next.attempts + 1, lastError })
        );
        if (outcome === 'auth' && !this.authStopActive) {
          this.authStopActive = true;
          this.store.dispatch(
            AppActions.operationFailed({ source: 'outboxDrain$', message: OUTBOX_MESSAGES.authBlocked })
          );
        }
        break;
      }

      // terminal
      try {
        await firstValueFrom(
          this.storage.updateStatus(next.localId, {
            status: 'failed',
            attempts: next.attempts + 1,
            lastError,
            failure: 'rejected'
          })
        );
      } catch (e) {
        log(e);
        break;
      }
      this.store.dispatch(
        OutboxActions.terminallyFailed({
          localId: next.localId,
          attempts: next.attempts + 1,
          lastError,
          failure: 'rejected'
        })
      );
      newlyFailed++;
    }

    try {
      finalRecords = await firstValueFrom(this.storage.getAll());
    } catch (e) {
      log(e);
    }
    this.store.dispatch(OutboxActions.hydrated({ records: finalRecords }));

    const remainingPending = finalRecords.filter((record) => record.status === 'pending').length;
    this.store.dispatch(OutboxActions.drainCompleted({ sent, newlyFailed, remainingPending, lastSent }));
  }

  private openFailureNotice(record: OutboxRecord): void {
    const ref = this.snackBar.openFromComponent(OutboxFailureNoticeComponent, {
      data: { record },
      politeness: 'assertive',
      verticalPosition: 'top'
    });

    ref.afterDismissed().subscribe(() => {
      const choice = ref.instance.choice();
      if (choice === 'retry') {
        this.store.dispatch(OutboxActions.retry({ localId: record.localId }));
      } else if (choice === 'discard') {
        this.store.dispatch(OutboxActions.discard({ localId: record.localId }));
      }
    });
  }

  private isOnDashboard(): boolean {
    const [path] = this.router.url.split('?');
    return path.split(';')[0] === `/${ROUTE.dashboard}`;
  }
}

function pickOldestPending(records: ReadonlyArray<OutboxRecord>): OutboxRecord | undefined {
  return [...records]
    .filter((record) => record.status === 'pending')
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt || a.localId.localeCompare(b.localId))[0];
}
