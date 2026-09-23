/**
 * One hold-to-record voice note, held in memory only by `VoiceRecorderService`
 * (`docs/specs/hold-to-record-voice.md` D1). Never persisted.
 */
export interface VoiceRecording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  recordedAt: Date;
}
