import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Toolbar badge for the write outbox (`docs/specs/write-outbox.md` D12). Presentational only --
 * `AppComponent` feeds it `pending`/`failed` from the store and dispatches `syncRequested` on
 * `activate`. Not exported from `src/shared/components/index.ts` (imported by direct path, like
 * the spec requires).
 */
@Component({
  selector: 'outbox-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatBadgeModule, MatButtonModule, MatIconModule],
  template: `
    @if (total() > 0) {
      <button
        mat-icon-button
        type="button"
        [matBadge]="total()"
        [matBadgeColor]="failed() > 0 ? 'warn' : 'accent'"
        matBadgeSize="small"
        [attr.aria-label]="label()"
        (click)="activate.emit()"
      >
        <mat-icon aria-hidden="true">cloud_upload</mat-icon>
      </button>
    }
  `
})
export class OutboxStatusComponent {
  readonly pending = input(0);
  readonly failed = input(0);
  readonly activate = output<void>();

  protected readonly total = computed(() => this.pending() + this.failed());

  protected readonly label = computed(() => {
    const pending = this.pending();
    const failed = this.failed();

    let status: string;
    if (pending > 0) {
      status = `${pending} ${pending === 1 ? 'expense' : 'expenses'} waiting to be sent`;
      if (failed > 0) {
        status += `, ${failed} couldn't be sent`;
      }
    } else {
      status = `${failed} ${failed === 1 ? 'expense' : 'expenses'} couldn't be sent`;
    }

    return `${status}. Send now`;
  });
}
