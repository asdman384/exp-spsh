import { Injectable, signal } from '@angular/core';

import { VoiceRecording } from 'src/shared/models';

export type VoiceRecorderStatus = 'idle' | 'requesting' | 'starting' | 'recording';

export type VoiceRecorderOutcome =
  | 'permission-granted'
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
 * Owns the microphone permission check, `getUserMedia`/`MediaRecorder` lifecycle, and the
 * latest in-memory recording (`docs/specs/hold-to-record-voice.md`). Feature-detects at call
 * time, never throws into the caller, and logs on every fallback or failure -- the same shape
 * as `NetworkStatusService`/`OutboxDrainLock`. Owns no copy text; `VoiceRecordButtonComponent`
 * turns `lastOutcome` into announcements.
 */
@Injectable({ providedIn: 'root' })
export class VoiceRecorderService {
  private readonly _status = signal<VoiceRecorderStatus>('idle');
  readonly status = this._status.asReadonly();

  private readonly _latest = signal<VoiceRecording | null>(null);
  readonly latest = this._latest.asReadonly();

  // Fires on every outcome, including ones no caller triggered (auto-stop, visibilitychange).
  // Wrapped in a fresh object each time so repeated identical outcomes still notify (D14 risk).
  private readonly _lastOutcome = signal<VoiceRecorderOutcomeEvent | null>(null);
  readonly lastOutcome = this._lastOutcome.asReadonly();

  // In-memory stand-in for the Permissions API (D14): set by the first successful
  // getUserMedia call this session, cleared by a NotAllowedError on the record path.
  private permissionGranted = false;

  // True once the record path's own getUserMedia call is in flight (status is still
  // 'starting' before that, while the permission state itself is being resolved).
  private recordPathStarting = false;
  private stopRequestedWhileStarting = false;

  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Array<Blob> = [];
  private startedAt = 0;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private limitReachedPending = false;

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

    const mediaDevices = navigator.mediaDevices;
    const MediaRecorderCtor = globalThis.MediaRecorder;
    if (!mediaDevices?.getUserMedia || !MediaRecorderCtor) {
      log('VoiceRecorderService: getUserMedia or MediaRecorder unavailable');
      this.reportOutcome('unsupported');
      return;
    }

    this.recordPathStarting = false;
    this.stopRequestedWhileStarting = false;
    this._status.set('starting');

    void this.startAfterPermissionCheck(mediaDevices, MediaRecorderCtor);
  }

  /**
   * Idempotent: a no-op while `idle`, `requesting`, or `starting` before the permission state
   * is known (D14). While `starting` on the record path it flags a pending cancellation. While
   * `recording` it stops the recorder; the `stop` event finishes the work.
   */
  stop(): void {
    const status = this._status();

    if (status === 'starting') {
      // D14: a release while the permission state is still being resolved, or during the
      // permission-only request, never cancels. Only the record path's own getUserMedia call
      // can be cancelled this way.
      if (this.recordPathStarting) {
        this.stopRequestedWhileStarting = true;
      }
      return;
    }

    if (status === 'recording') {
      this.clearLimitTimer();
      this.recorder?.stop();
    }

    // 'requesting' and 'idle': no-op.
  }

  private async startAfterPermissionCheck(
    mediaDevices: MediaDevices,
    MediaRecorderCtor: typeof MediaRecorder
  ): Promise<void> {
    const permissionState = await this.resolvePermissionState();

    if (permissionState === 'denied') {
      log('VoiceRecorderService: microphone permission denied (Permissions API)');
      this.reportOutcome('denied');
      this._status.set('idle');
      return;
    }

    if (permissionState !== 'granted') {
      await this.requestPermissionOnly(mediaDevices);
      return;
    }

    await this.startRecordPath(mediaDevices, MediaRecorderCtor);
  }

  private async resolvePermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
    if (this.permissionGranted) {
      return 'granted';
    }

    const permissions = navigator.permissions;
    if (!permissions?.query) {
      return 'unknown';
    }

    try {
      const status = await permissions.query({ name: 'microphone' as PermissionName });
      return status.state;
    } catch (e) {
      log('VoiceRecorderService: permissions.query unavailable for microphone', e);
      return 'unknown';
    }
  }

  // D14: permission not known granted -- this press only triggers the browser prompt.
  private async requestPermissionOnly(mediaDevices: MediaDevices): Promise<void> {
    this._status.set('requesting');
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.permissionGranted = true;
      this.reportOutcome('permission-granted');
    } catch (e) {
      this.reportGetUserMediaError(e);
    } finally {
      this._status.set('idle');
    }
  }

  private async startRecordPath(mediaDevices: MediaDevices, MediaRecorderCtor: typeof MediaRecorder): Promise<void> {
    this.recordPathStarting = true;

    let stream: MediaStream;
    try {
      stream = await mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      this.reportGetUserMediaError(e);
      this._status.set('idle');
      return;
    }

    if (this.stopRequestedWhileStarting) {
      this.stopRequestedWhileStarting = false;
      stream.getTracks().forEach((track) => track.stop());
      this._status.set('idle');
      return;
    }

    this.beginRecording(stream, MediaRecorderCtor);
  }

  private beginRecording(stream: MediaStream, MediaRecorderCtor: typeof MediaRecorder): void {
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorderCtor(stream);
    } catch (e) {
      log('VoiceRecorderService: MediaRecorder construction failed', e);
      stream.getTracks().forEach((track) => track.stop());
      this._status.set('idle');
      this.reportOutcome('failed');
      return;
    }

    const chunks: Array<Blob> = [];

    recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener('error', (event: Event) => {
      log('VoiceRecorderService: MediaRecorder error', event);
      this.clearLimitTimer();
      stream.getTracks().forEach((track) => track.stop());
      this.recorder = null;
      this.stream = null;
      this.chunks = [];
      this.limitReachedPending = false;
      this._status.set('idle');
      this.reportOutcome('failed');
    });

    recorder.addEventListener('stop', () => {
      const durationMs = Date.now() - this.startedAt;
      stream.getTracks().forEach((track) => track.stop());
      this.clearLimitTimer();

      const limitReached = this.limitReachedPending;
      this.limitReachedPending = false;

      if (durationMs < MIN_DURATION_MS) {
        this.reportOutcome('too-short');
      } else {
        this._latest.set({
          blob: new Blob(chunks, { type: recorder.mimeType }),
          mimeType: recorder.mimeType,
          durationMs,
          recordedAt: new Date()
        });
        this.reportOutcome(limitReached ? 'limit-reached' : 'saved');
      }

      this.recorder = null;
      this.stream = null;
      this.chunks = [];
      this._status.set('idle');
    });

    this.recorder = recorder;
    this.stream = stream;
    this.chunks = chunks;

    try {
      this.startedAt = Date.now();
      recorder.start();
    } catch (e) {
      log('VoiceRecorderService: recorder.start failed', e);
      stream.getTracks().forEach((track) => track.stop());
      this.recorder = null;
      this.stream = null;
      this.chunks = [];
      this._status.set('idle');
      this.reportOutcome('failed');
      return;
    }

    this._status.set('recording');
    this.reportOutcome('started');

    this.limitTimer = setTimeout(() => {
      this.limitReachedPending = true;
      this.stop();
    }, MAX_DURATION_MS);
  }

  // D8: map the DOMException by name. A missing API never reaches here (handled in start()).
  private reportGetUserMediaError(e: unknown): void {
    log('VoiceRecorderService: getUserMedia failed', e);
    const name = e instanceof DOMException ? e.name : undefined;

    let outcome: VoiceRecorderOutcome;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      outcome = 'denied';
      this.permissionGranted = false;
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      outcome = 'no-device';
    } else {
      outcome = 'failed';
    }

    this.reportOutcome(outcome);
  }

  private reportOutcome(outcome: VoiceRecorderOutcome): void {
    this._lastOutcome.set({ outcome, at: Date.now() });
  }

  private clearLimitTimer(): void {
    if (this.limitTimer !== null) {
      clearTimeout(this.limitTimer);
      this.limitTimer = null;
    }
  }
}
