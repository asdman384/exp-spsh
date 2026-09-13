import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarLabel,
  MatSnackBarRef
} from '@angular/material/snack-bar';
import { OutboxRecord } from 'src/shared/models';

export interface OutboxFailureNoticeData {
  record: OutboxRecord;
}

/**
 * Snackbar body for a `failed` outbox record (`docs/specs/write-outbox.md` D13). `OutboxEffects`
 * opens this with `MatSnackBar.openFromComponent` and reads `choice()` from
 * `MatSnackBarRef.instance` after `afterDismissed()`, since Material's snackbar has no other
 * return-value channel.
 */
@Component({
  selector: 'outbox-failure-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatSnackBarAction, MatSnackBarActions, MatSnackBarLabel],
  template: `
    <span matSnackBarLabel>
      @if (record.failure === 'otherSpreadsheet') {
        A saved expense ({{ record.payload.expense.category }}, {{ record.payload.expense.amount }},
        {{ record.enqueuedAt | date: 'd MMM, HH:mm' }}) belongs to a different spreadsheet from the one you're
        using now. Retry, or discard it?
      } @else {
        Couldn't send a saved expense: {{ record.payload.expense.category }}, {{ record.payload.expense.amount }},
        {{ record.enqueuedAt | date: 'd MMM, HH:mm' }}. Retry, or discard it?
      }
    </span>
    <div matSnackBarActions>
      <button mat-button matSnackBarAction type="button" (click)="choose('retry')">Retry</button>
      <button mat-button matSnackBarAction type="button" (click)="choose('discard')">Discard</button>
      <button mat-button matSnackBarAction type="button" (click)="choose('close')">Close</button>
    </div>
  `
})
export class OutboxFailureNoticeComponent {
  private readonly snackBarRef = inject(MatSnackBarRef<OutboxFailureNoticeComponent>);
  private readonly data = inject<OutboxFailureNoticeData>(MAT_SNACK_BAR_DATA);

  protected readonly record: OutboxRecord = this.data.record;

  /** Read by `OutboxEffects` from `MatSnackBarRef.instance` after `afterDismissed()`. */
  readonly choice = signal<'retry' | 'discard' | 'close' | undefined>(undefined);

  protected choose(choice: 'retry' | 'discard' | 'close'): void {
    this.choice.set(choice);
    this.snackBarRef.dismiss();
  }
}
