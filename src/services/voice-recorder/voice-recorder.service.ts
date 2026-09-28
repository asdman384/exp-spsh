import { Injectable, signal } from '@angular/core';

import { VoiceRecording } from 'src/shared/models';

export type VoiceRecorderStatus = 'idle' | 'starting' | 'recording';

export type VoiceRecorderOutcome =
  | 'released-early'
  | 'started'
  | 'saved'
  | 'too-short'
  | 'limit-reached'
  | 'unsupported'
  | 'denied'
  | 'no-device'
  | 'failed';

export interface VoiceRecorderOutcomeEvent {
  outcome: VoiceRecorderOutcome;
  at: number;
}

const MAX_DURATION_MS = 60_000;
const MIN_DURATION_MS = 1000;

/**
 * Owns the `getUserMedia`/`MediaRecorder` lifecycle and the latest in-memory recording
 * (`docs/specs/hold-to-record-voice.md`). Feature-detects at call time, never throws into the
 * caller, and logs on every fallback or failure -- the same shape as `NetworkStatusService`.
 * Owns no copy text; `VoiceRecordButtonComponent` turns `lastOutcome` into announcements.
 *
 * There is no separate permission step: the first press's `getUserMedia` shows the browser
 * prompt, the release while it is open cancels that start (`released-early`), and the grant
 * the browser keeps lets the next press record.
 */
@Injectable({ providedIn: 'root' })
export class VoiceRecorderService {
  private readonly _status = signal<VoiceRecorderStatus>('idle');
  readonly status = this._status.asReadonly();

  private readonly _latest = signal<VoiceRecording | null>(null);
  readonly latest = this._latest.asReadonly();

  // Fires on every outcome, including ones no caller triggered (auto-stop, visibilitychange).
  // Wrapped in a fresh object each time so repeated identical outcomes still notify.
  private readonly _lastOutcome = signal<VoiceRecorderOutcomeEvent | null>(null);
  readonly lastOutcome = this._lastOutcome.asReadonly();

  private stopRequestedWhileStarting = false;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      }
    });
  }

  /** Idempotent: a press while not idle does nothing (AC14, D11). */
  start(): void {
    if (this._status() !== 'idle') {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      log('VoiceRecorderService: getUserMedia or MediaRecorder unavailable');
      this.reportOutcome('unsupported');
      return;
    }

    this.stopRequestedWhileStarting = false;
    this._status.set('starting');
    void this.open();
  }

  /**
   * Idempotent: a no-op while `idle`. While `starting` it flags the pending start as
   * cancelled; while `recording` it stops the recorder, and the `stop` event finishes the work.
   */
  stop(): void {
    switch (this._status()) {
      case 'starting':
        this.stopRequestedWhileStarting = true;
        break;
      case 'recording':
        this.recorder?.stop();
        break;
    }
  }

  private async open(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      log('VoiceRecorderService: getUserMedia failed', e);
      this.finish(classifyGetUserMediaError(e));
      return;
    }

    if (this.stopRequestedWhileStarting) {
      this.finish('released-early');
      return;
    }

    const chunks: Array<Blob> = [];
    let startedAt = 0;

    try {
      const recorder = new MediaRecorder(this.stream);
      this.recorder = recorder;

      recorder.addEventListener('dataavailable', (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener('error', (event: Event) => {
        log('VoiceRecorderService: MediaRecorder error', event);
        this.finish('failed');
      });

      recorder.addEventListener('stop', () => {
        if (this.recorder !== recorder) {
          return; // already finished by 'error'
        }
        const durationMs = Date.now() - startedAt;
        if (durationMs < MIN_DURATION_MS) {
          this.finish('too-short');
          return;
        }
        this._latest.set({
          blob: new Blob(chunks, { type: recorder.mimeType }),
          mimeType: recorder.mimeType,
          durationMs,
          recordedAt: new Date()
        });
        // The timer is set after `startedAt`, so an auto-stop always measures at least the cap.
        this.finish(durationMs >= MAX_DURATION_MS ? 'limit-reached' : 'saved');
      });

      startedAt = Date.now();
      recorder.start();
    } catch (e) {
      log('VoiceRecorderService: MediaRecorder could not start', e);
      this.finish('failed');
      return;
    }

    this._status.set('recording');
    this.reportOutcome('started');
    this.limitTimer = setTimeout(() => this.stop(), MAX_DURATION_MS);
  }

  /** The single exit from `starting`/`recording`: releases every track and returns to idle. */
  private finish(outcome: VoiceRecorderOutcome): void {
    if (this.limitTimer !== null) {
      clearTimeout(this.limitTimer);
      this.limitTimer = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this._status.set('idle');
    this.reportOutcome(outcome);
  }

  private reportOutcome(outcome: VoiceRecorderOutcome): void {
    this._lastOutcome.set({ outcome, at: Date.now() });
  }
}

// D8: map the DOMException by name. A missing API never reaches here (handled in start()).
function classifyGetUserMediaError(e: unknown): VoiceRecorderOutcome {
  const name = e instanceof DOMException ? e.name : undefined;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'denied';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'no-device';
  }
  return 'failed';
}
