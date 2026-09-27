---
type: Flow
title: Hold-to-record voice note
description: The dashboard's hold-to-record button, the permission-first press, the single in-memory recording, and how it becomes queued expenses via Gemini.
tags: [flow, voice, microphone, accessibility, gemini]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/voice-recorder/voice-recorder.service.ts
    title: VoiceRecorderService
  - id: model
    resource: ../../src/shared/models/voice-recording.ts
    title: VoiceRecording
  - id: btn
    resource: ../../src/shared/components/voice-record-button/voice-record-button.component.ts
    title: VoiceRecordButtonComponent
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.ts
    title: DashboardPageContainer
---

# What it is

A 56 × 56 px button after **Add Expense** on the dashboard.[^btn] Holding it (pointer, or
Space/Enter) records from the microphone; releasing keeps the clip in memory. Each new clip is
sent to Gemini and every recognized expense is queued like a typed one (see
[Recognition](#recognition)). There is no playback, and the clip is never persisted.

| Part | Owns |
|---|---|
| `VoiceRecorderService` (root) | permission, `getUserMedia`/`MediaRecorder` lifecycle, `status` and `latest` signals, `lastOutcome`[^svc] |
| `VoiceRecordButtonComponent` | the hold gesture, the indicator, `LiveAnnouncer` messages; `disabled` while `loadingSelector` is true[^btn] |
| `DashboardPageContainer` | sends each new clip to `ExpenseRecognitionService` and queues the result[^page] |

`status` is `'idle' | 'requesting' | 'starting' | 'recording'`; `latest` is
`VoiceRecording | null` (`blob`, `mimeType`, `durationMs`, `recordedAt`).[^model] The clip is
not in NgRx (a `Blob` is not serialisable); it survives logout and is lost on reload.

# Permission-first press

`start()` (a no-op unless `idle`) first resolves the permission: an in-memory flag set by an
earlier successful `getUserMedia`, else `navigator.permissions.query({ name: 'microphone' })`.

- **granted** → record (below);
- **denied** → report `denied`, no `getUserMedia` call;
- **prompt / unknown** → the press only triggers the browser prompt: `status` `requesting`,
  `getUserMedia` then stop every track, set the flag. The next hold records. A release during
  this step does not cancel it.

A `NotAllowedError` on the record path clears the flag.

# Recording

`getUserMedia({ audio: true })` (`status` stays `starting`; a release now cancels), then a
`MediaRecorder` with the browser's default codec, `status` `recording`, and a 60 s auto-stop
(`limit-reached`). On stop every track is released and:

- under 1000 ms → `too-short`, `latest` unchanged;
- otherwise → `latest` replaced, `saved` or `limit-reached`.

`getUserMedia` errors map by `DOMException.name`: `NotAllowedError`/`SecurityError` →
`denied`, `NotFoundError`/`OverconstrainedError` → `no-device`, else `failed`; a missing API →
`unsupported`. Failures are logged and announced, never toasted. `visibilitychange` → hidden
stops a recording.

# Gesture and feedback

- `pointerdown` (primary button) captures the pointer and calls `start()`; `pointerup`,
  `pointercancel`, `lostpointercapture` call `stop()`.
- `keydown` Space/Enter (not `repeat`) starts; `keyup` of the same key and `blur` stop.
- `contextmenu` is suppressed; `DestroyRef.onDestroy` calls `stop()`.
- Recording shows `mic` on red `#d32f2f` with a pulse (none under `prefers-reduced-motion`);
  otherwise `mic_none`. `aria-pressed` tracks recording, `aria-busy` tracks
  `requesting`/`starting`. Every outcome is announced politely.

# Recognition

`DashboardPageContainer` subscribes to `toObservable(recorder.latest)`, skipping the clip
already held when the page opens.[^page] For each new clip it dispatches `loading(true)`, calls
`ExpenseRecognitionService.recognize(clip, categoryNames, new Date())`
([Gemini](../interfaces/gemini-api.md)), and `switchMap` drops an older in-flight request.

- **Success** — the result is logged, then each `Expense` goes to
  `ExpensesService.add(currentSheet.id, expense)`, i.e. into the
  [write outbox](../architecture/write-outbox.md), exactly like a form submit.
- **Failure** (including "no valid expenses") — logged, then
  `operationFailed({ source: 'Gemini', message: error })`: the toast shows the raw error
  ([known issues](../constraints/known-issues.md) #33).
- `loading(false)` in `finalize`; while loading, the voice button is disabled.

[^svc]: VoiceRecorderService
[^model]: VoiceRecording
[^btn]: VoiceRecordButtonComponent
[^page]: DashboardPageContainer
