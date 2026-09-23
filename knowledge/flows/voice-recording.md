---
type: Flow
title: Hold-to-record voice note
description: The dashboard's square hold-to-record button, the permission-first press, and the single in-memory recording it produces.
tags: [flow, voice, microphone, accessibility]
status: stable
generated: { by: claude_code/claude-sonnet-5, at: 2026-09-24T00:00:00Z }
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
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.html
    title: Dashboard form template
---

# What it is

A 56 × 56 px square button next to **Add Expense** on the dashboard, after it in DOM and tab
order.[^page] Holding it (pointer or Space/Enter) records audio from the microphone; releasing
it keeps the result as one in-memory `Blob` until the app reloads. There is no UI to play back,
share, or persist a recording, no speech-to-text, and no link to an expense — the recording is
a standalone capability with nothing downstream yet.

`VoiceRecorderService` is a root-provided service that owns permission, the `getUserMedia` /
`MediaRecorder` lifecycle, and the latest recording, exposed as two read-only signals: `status`
(`'idle' | 'requesting' | 'starting' | 'recording'`) and `latest` (`VoiceRecording | null`).[^svc]
`VoiceRecordButtonComponent` owns only the gesture and the visual/announced feedback; it holds
no media state itself.[^btn] Nothing here touches the NgRx store, `SpreadsheetService`, or any
persistence layer — the `Blob` is not serialisable and does not belong in the `app` slice.

# Permission-first press

The service never assumes a press means "record". `start()` first works out whether the
microphone permission is already granted: an in-memory flag set by an earlier successful
`getUserMedia` this session, or, failing that, the Permissions API (`navigator.permissions.query
({ name: 'microphone' })` where available).[^svc]

- **Granted** (flag or Permissions API): the press records, following the "Recording" steps
  below.
- **Denied** (Permissions API only): `start()` reports `denied` and never calls `getUserMedia` —
  the browser will not re-prompt, so the user must re-enable the permission in site settings.
- **Prompt, or unknown** (no Permissions API, or it rejects): the press is **permission-only**.
  `status` becomes `requesting`, `getUserMedia({ audio: true })` runs purely to trigger the
  browser prompt, and as soon as it resolves every track is stopped at once — no
  `MediaRecorder` is created and `latest` is untouched. The in-memory flag is set, and the next
  press-and-hold takes the recording path. A release (`stop()`) during `requesting`, or while the
  permission state is still being resolved, does not cancel the request — the click itself is
  the request, and the user almost always lets go to answer the prompt.

A `NotAllowedError` on the recording path (a previously granted permission that the user then
revoked) clears the in-memory flag, so the next press is permission-only again.

# Recording

Once permission is known granted, `start()` requests `getUserMedia({ audio: true })` (`status`
stays `starting`); a release during this call flags it as cancelled, so once it resolves every
track is stopped and nothing is recorded. Otherwise a `MediaRecorder` is created over the stream
with no `mimeType` option — the browser's default codec (`audio/webm;codecs=opus` on Chromium,
`audio/mp4` on Safari) — and `status` becomes `recording`. A 60 s timer auto-stops the
recording and reports `limit-reached`.[^svc]

On `stop()`, every track is stopped, `durationMs` is computed from `MediaRecorder.start()` to
its `stop` event, and:

- under 1000 ms, the chunks are dropped and `latest` is left exactly as it was (`too-short`);
- otherwise `latest` is replaced with a new `VoiceRecording` (`blob`, `mimeType`, `durationMs`,
  `recordedAt`), reporting `saved` or `limit-reached`.[^model]

Every `getUserMedia` rejection is mapped by `DOMException.name`: `NotAllowedError` /
`SecurityError` → `denied`; `NotFoundError` / `OverconstrainedError` → `no-device`; anything
else, or a missing `mediaDevices`/`MediaRecorder` API, → `unsupported` or `failed`. Every case
is logged and leaves `status` `idle` without throwing. A `MediaRecorder` construction failure or
`error` event stops the tracks, logs, and keeps the previous `latest`.

The service also stops any in-progress recording on `document`'s `visibilitychange` → `hidden`,
so a backgrounded tab never leaves the microphone hot.

# Component gesture and feedback

`VoiceRecordButtonComponent` wires the hold gesture entirely in its own template (not
`@HostListener`, per this repo's code style):[^btn]

- `pointerdown` (primary button only) calls `setPointerCapture` then `start()`; `pointerup`,
  `pointercancel`, and `lostpointercapture` each call `stop()`. `pointerleave` alone does
  nothing, so the user can drift off the button while still holding.
- `keydown` of Space or Enter (`!event.repeat`) calls `preventDefault()` then `start()`;
  `keyup` of the same key, and `blur`, call `stop()`.
- `contextmenu` is suppressed so a long press on mobile does not open the context menu.
- `DestroyRef.onDestroy` calls `stop()` — a route change mid-recording finalises the clip
  exactly as a normal release would, since the service is root and outlives the component.

Visually: idle, `requesting`, and `starting` all show the `mic_none` icon with
`aria-pressed="false"` (`requesting`/`starting` additionally set `aria-busy="true"`); `recording`
shows `mic` on a red (`#d32f2f`) background with a white icon and a pulsing `box-shadow`
animation, disabled under `prefers-reduced-motion: reduce`. Every outcome the service reports
(`permission-granted`, `started`, `saved`, `too-short`, `limit-reached`, `denied`, `unsupported`,
`no-device`, `failed`) is announced once via `LiveAnnouncer` at `'polite'` politeness — the
service owns no copy text; the component maps outcomes to messages.

# What is deliberately absent

No failure toast: microphone failures are logged and announced only, never routed through
`operationFailed` / `showFailureToast$`. No codec choice or transcoding — the browser's default
`mimeType` is stored alongside the `Blob`. No on-screen elapsed/remaining time, only the 60 s
cap. The recording is **not** cleared on logout (`AppComponent.logout` does not reload); it is
lost only on an actual page reload.

[^svc]: VoiceRecorderService
[^model]: VoiceRecording
[^btn]: VoiceRecordButtonComponent
[^page]: Dashboard form template
