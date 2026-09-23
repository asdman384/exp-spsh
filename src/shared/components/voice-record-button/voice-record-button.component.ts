import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { VoiceRecorderOutcome, VoiceRecorderService } from 'src/services';

const OUTCOME_MESSAGES: Record<VoiceRecorderOutcome, string> = {
  'permission-granted': 'Microphone ready. Press and hold to record',
  started: 'Recording',
  saved: 'Recording stopped',
  'limit-reached': 'Recording stopped, 60 second limit reached',
  'too-short': 'Recording too short, discarded',
  denied: 'Microphone permission denied',
  unsupported: 'Microphone unavailable',
  'no-device': 'Microphone unavailable',
  failed: 'Microphone unavailable'
};

/**
 * Hold-to-record voice note button (`docs/specs/hold-to-record-voice.md`). Presentational only
 * -- owns the pointer/keyboard hold gesture and the recording indicator, and delegates every
 * media decision to `VoiceRecorderService`. Not exported from `src/shared/components/index.ts`
 * (imported by direct path from `DashboardPageContainer`, like `OutboxStatusComponent`).
 */
@Component({
  selector: 'voice-record-button',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      mat-icon-button
      type="button"
      class="voice-record-button"
      [class.recording]="isRecording()"
      [attr.aria-pressed]="isRecording()"
      [attr.aria-busy]="isBusy()"
      aria-label="Hold to record voice note"
      (pointerdown)="onPointerDown($event)"
      (pointerup)="onPointerUp()"
      (pointercancel)="onPointerCancel()"
      (lostpointercapture)="onLostPointerCapture()"
      (keydown)="onKeyDown($event)"
      (keyup)="onKeyUp($event)"
      (blur)="onBlur()"
      (contextmenu)="onContextMenu($event)"
    >
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
    </button>
  `,
  styleUrl: './voice-record-button.component.scss'
})
export class VoiceRecordButtonComponent {
  private readonly recorder = inject(VoiceRecorderService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isRecording = computed(() => this.recorder.status() === 'recording');
  protected readonly isBusy = computed(() => {
    const status = this.recorder.status();
    return status === 'starting' || status === 'requesting';
  });
  protected readonly icon = computed(() => (this.isRecording() ? 'mic' : 'mic_none'));

  // Announces every outcome, including auto-stop and visibilitychange ones no handler here
  // triggered (docs/specs/hold-to-record-voice.md, "Outcome reporting").
  private readonly announceOutcome = effect(() => {
    const event = this.recorder.lastOutcome();
    if (!event) {
      return;
    }
    void this.liveAnnouncer.announce(OUTCOME_MESSAGES[event.outcome], 'polite');
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.recorder.stop());
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.recorder.start();
  }

  protected onPointerUp(): void {
    this.recorder.stop();
  }

  protected onPointerCancel(): void {
    this.recorder.stop();
  }

  protected onLostPointerCapture(): void {
    this.recorder.stop();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) {
      return;
    }
    event.preventDefault();
    this.recorder.start();
  }

  protected onKeyUp(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return;
    }
    this.recorder.stop();
  }

  protected onBlur(): void {
    this.recorder.stop();
  }

  protected onContextMenu(event: Event): void {
    event.preventDefault();
  }
}
