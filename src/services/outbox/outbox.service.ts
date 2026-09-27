import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { EMPTY, Observable, Subject, catchError, concatMap, filter, finalize, firstValueFrom, from, pairwise, take, tap } from 'rxjs';

import { AppActions } from 'src/@state/app.actions';
import { reportFailure } from 'src/@state/report-failure';
import { classifyWriteError, toMessage } from 'src/shared/helpers';
import { Expense, OutboxRecord } from 'src/shared/models';
import { OutboxFailureNoticeComponent } from 'src/shared/components/outbox-failure-notice/outbox-failure-notice.component';

import { NetworkStatusService } from '../network-status.service';
import { AbstractSecurityService } from '../security';
import { SpreadsheetService } from '../spreadsheet/spreadsheet.service';
import { OUTBOX_MESSAGES } from './outbox-messages';
import { OutboxRecordPatch, OutboxStorage } from './outbox-storage';

/**
 * The write outbox (`docs/specs/write-outbox.md`): every new expense is persisted in IndexedDB
 * first and sent to the spreadsheet by a serial drain pass. `records` mirrors IndexedDB, ordered
 * by `(enqueuedAt, localId)`.
 */
@Injectable({ providedIn: 'root' })
export class OutboxService {
  private readonly store = inject(Store);
  private readonly status = inject(NetworkStatusService);
  private readonly security = inject(AbstractSecurityService);
  private readonly spreadSheetService = inject(SpreadsheetService);
  private readonly storage = inject(OutboxStorage);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  private readonly state = signal<Array<OutboxRecord>>([]);
  readonly records = this.state.asReadonly();
  readonly pendingCount = computed(() => this.state().filter((record) => record.status === 'pending').length);
  readonly failedCount = computed(() => this.state().filter((record) => record.status === 'failed').length);

  private readonly sent = new Subject<OutboxRecord>();
  /** The last record a drain pass sent, once per pass that sent anything. */
  readonly sent$: Observable<OutboxRecord> = this.sent.asObservable();

  private readonly enqueue$ = new Subject<OutboxRecord>();

  private initialized = false;
  // P1 (D7): set once boot hydration has completed successfully. Never reset.
  private hydrationDone = false;

  // Single-flight + coalesced rerun (D6): at most one pass runs; a trigger during a pass sets
  // `rerunRequested`, and exactly one more pass runs once the current one ends.
  private running = false;
  private rerunRequested = false;

  // An id whose send succeeded this session is never sent again, even if its
  // `remove` failed.
  private readonly sessionSent = new Set<string>();

  // D3's auth-toast edge trigger: true while the most recent stop was an auth stop with no
  // successful send since.
  private authStopActive = false;

  constructor() {
    // Persist-first, in arrival order.
    this.enqueue$
      .pipe(
        concatMap((record) =>
          this.storage.add(record).pipe(
            tap(() => {
              this.state.update((records) => sortRecords([...records, record]));
              this.scheduleRun();
              void this.liveAnnouncer.announce(OUTBOX_MESSAGES.queued, 'polite');
            }),
            catchError(reportFailure('addExpense$', this.store))
          )
        )
      )
      .subscribe();
  }

  /** Hydrates from IndexedDB and starts listening for drain triggers. Called once at startup. */
  init(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    log('OutboxService::init');

    // T2: online rising edge. T3: every NavigationEnd.
    this.status.online$
      .pipe(
        pairwise(),
        filter(([wasOnline, isOnline]) => !wasOnline && isOnline)
      )
      .subscribe(() => this.scheduleRun());
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.scheduleRun());

    if (!this.storage.isAvailable()) {
      return;
    }
    this.storage.getAll().subscribe({
      next: (records) => {
        this.state.set(sortRecords(records));
        this.hydrationDone = true;
        this.scheduleRun(); // T1
      },
      error: (e: unknown) => log(e)
    });
  }

  /** Queues a new expense and asks for a drain pass. */
  add(sheetId: number, expense: Expense): void {
    log('OutboxService::add', sheetId, expense);
    const { date, amount, category, comment, isInDebt } = expense;
    this.enqueue$.next({
      localId: crypto.randomUUID(),
      kind: 'addExpense',
      spreadsheetId: this.spreadSheetService.getSpreadsheetId(),
      payload: { sheetId, expense: { date, amount, category, comment, isInDebt } },
      enqueuedAt: Date.now(),
      status: 'pending',
      attempts: 0
    });
  }

  /** The toolbar "Send now": starts a pass (T5) and reopens the notice for a failed record. */
  sync(): void {
    log('OutboxService::sync');
    this.scheduleRun();
    this.openOldestFailureNotice();
  }

  private retry(localId: string): void {
    log('OutboxService::retry', localId);
    this.storage
      .updateStatus(localId, { status: 'pending', failure: undefined })
      .pipe(
        concatMap(() => this.storage.getAll()),
        tap((records) => {
          this.state.set(sortRecords(records));
          this.scheduleRun();
        }),
        catchError((e: unknown) => {
          log(e);
          return EMPTY;
        })
      )
      .subscribe();
  }

  private discard(localId: string): void {
    log('OutboxService::discard', localId);
    this.storage
      .remove(localId)
      .pipe(
        concatMap(() => this.storage.getAll()),
        tap((records) => this.state.set(sortRecords(records))),
        catchError((e: unknown) => {
          log(e);
          return EMPTY;
        })
      )
      .subscribe();
  }

  private scheduleRun(): void {
    log('OutboxService: drain trigger');
    if (this.running) {
      this.rerunRequested = true;
      return;
    }
    this.running = true;
    from(this.runPassAsync())
      .pipe(
        catchError((e: unknown) => {
          log(e);
          return EMPTY;
        }),
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

  private async runPassAsync(): Promise<void> {
    if (!(await this.preconditionsMet())) {
      return;
    }
    await this.runPass();
  }

  private async preconditionsMet(): Promise<boolean> {
    if (!this.hydrationDone) {
      log('OutboxService: precondition P1 (hydration) not met; skipping drain pass');
      return false;
    }
    const online = await firstValueFrom(this.status.online$.pipe(take(1)));
    if (!online) {
      log('OutboxService: precondition P2 (online) not met; skipping drain pass');
      return false;
    }
    const user = await firstValueFrom(this.security.user$.pipe(take(1)));
    if (!user) {
      log('OutboxService: precondition P3 (signed in) not met; skipping drain pass');
      return false;
    }
    if (!this.spreadSheetService.getSpreadsheetId()) {
      log('OutboxService: precondition P4 (spreadsheet id) not met; skipping drain pass');
      return false;
    }
    return true;
  }

  private async runPass(): Promise<void> {
    const initial = await firstValueFrom(this.storage.getAll());
    this.state.set(sortRecords(initial));

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

      const next = sortRecords(fresh).find((record) => record.status === 'pending');
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
        const patch: OutboxRecordPatch = { status: 'failed', failure: 'otherSpreadsheet' };
        try {
          await firstValueFrom(this.storage.updateStatus(next.localId, patch));
        } catch (e) {
          log(e);
          break;
        }
        this.patch(next.localId, patch);
        newlyFailed++;
        continue;
      }

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
        this.state.update((records) => records.filter((record) => record.localId !== next.localId));
        this.authStopActive = false;
        sent++;
        lastSent = next;
        continue;
      }

      const lastError = toMessage(sendError);

      if (outcome === 'retryable' || outcome === 'auth') {
        const patch: OutboxRecordPatch = { status: 'pending', attempts: next.attempts + 1, lastError };
        try {
          await firstValueFrom(this.storage.updateStatus(next.localId, patch));
        } catch (e) {
          log(e);
          break;
        }
        this.patch(next.localId, patch);
        if (outcome === 'auth' && !this.authStopActive) {
          this.authStopActive = true;
          this.store.dispatch(
            AppActions.operationFailed({ source: 'outboxDrain$', message: OUTBOX_MESSAGES.authBlocked })
          );
        }
        break;
      }

      // terminal
      const patch: OutboxRecordPatch = { status: 'failed', attempts: next.attempts + 1, lastError, failure: 'rejected' };
      try {
        await firstValueFrom(this.storage.updateStatus(next.localId, patch));
      } catch (e) {
        log(e);
        break;
      }
      this.patch(next.localId, patch);
      newlyFailed++;
    }

    try {
      finalRecords = await firstValueFrom(this.storage.getAll());
    } catch (e) {
      log(e);
    }
    this.state.set(sortRecords(finalRecords));

    const remainingPending = finalRecords.filter((record) => record.status === 'pending').length;
    log('OutboxService: drain pass completed', { sent, newlyFailed, remainingPending });
    if (newlyFailed > 0) {
      this.openOldestFailureNotice();
    }
    if (sent > 0 && remainingPending === 0) {
      void this.liveAnnouncer.announce(OUTBOX_MESSAGES.allSent, 'polite');
    }
    if (lastSent) {
      this.sent.next(lastSent);
    }
  }

  private patch(localId: string, changes: OutboxRecordPatch): void {
    this.state.update((records) =>
      records.map((record) => (record.localId === localId ? { ...record, ...changes } : record))
    );
  }

  private openOldestFailureNotice(): void {
    const record = this.state().find((r) => r.status === 'failed');
    if (!record) {
      return;
    }
    const ref = this.snackBar.openFromComponent(OutboxFailureNoticeComponent, {
      data: { record },
      politeness: 'assertive',
      verticalPosition: 'top'
    });

    ref.afterDismissed().subscribe(() => {
      const choice = ref.instance.choice();
      if (choice === 'retry') {
        this.retry(record.localId);
      } else if (choice === 'discard') {
        this.discard(record.localId);
      }
    });
  }
}

function sortRecords(records: ReadonlyArray<OutboxRecord>): Array<OutboxRecord> {
  return [...records].sort((a, b) => a.enqueuedAt - b.enqueuedAt || a.localId.localeCompare(b.localId));
}
