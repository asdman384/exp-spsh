---
type: Flow
title: Hold-to-record voice note
description: The dashboard's hold-to-record button, the first-press browser prompt, the single in-memory recording, and how it becomes queued expenses via Gemini.
tags: [flow, voice, microphone, accessibility, gemini]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-28T00:00:00Z }
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
| `VoiceRecorderService` (root) | `getUserMedia`/`MediaRecorder` lifecycle, `status` and `latest` signals, `lastOutcome`[^svc] |
| `VoiceRecordButtonComponent` | the hold gesture, the indicator, `LiveAnnouncer` messages; `disabled` while `loadingSelector` is true[^btn] |
| `DashboardPageContainer` | sends each new clip to `ExpenseRecognitionService` and queues the result[^page] |

`status` is `'idle' | 'starting' | 'recording'`; `latest` is
`VoiceRecording | null` (`blob`, `mimeType`, `durationMs`, `recordedAt`).[^model] The clip is
not in NgRx (a `Blob` is not serialisable); it survives logout and is lost on reload.

# Recording

`start()` (a no-op unless `idle`) sets `status` `starting` and calls
`getUserMedia({ audio: true })`. There is no separate permission step and no Permissions API
call: on the first press this call shows the browser prompt. A release while `starting`
cancels the start — once `getUserMedia` resolves every track is stopped, nothing is recorded,
and `released-early` is reported ("Microphone ready. Press and hold to record"). The browser
keeps the grant, so the next hold records. A denied permission rejects with `NotAllowedError`.

Otherwise a `MediaRecorder` with the browser's default codec starts, `status` becomes
`recording`, and a 60 s timer calls `stop()`. On the recorder's `stop` event every track is
released and:

- under 1000 ms → `too-short`, `latest` unchanged;
- otherwise → `latest` replaced, `limit-reached` if it lasted ≥ 60 s, else `saved`.

Every exit from `starting`/`recording` goes through one private `finish(outcome)`, which clears
the timer, stops every track, and returns to `idle`. A recorder `error` finishes with `failed`;
a `stop` event arriving after it is ignored.

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
  `starting`. Every outcome is announced politely.

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
