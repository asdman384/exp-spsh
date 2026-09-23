# Hold-to-record voice note on the dashboard

## Goal

Add a square hold-to-record button next to **Add Expense** on the dashboard. While the user holds it (pointer or Space/Enter), the app records audio from the microphone. When the user lets go, it keeps the result as one in-memory `Blob` until the app restarts, and it shows clearly that recording is in progress. If the app does not yet have microphone permission, the first press only asks for it (the browser's permission prompt) and records nothing. Once permission is granted, the next press-and-hold records. The repo owner (Oleg) asked for this and decided the four open points (latest recording only, red pulsing indicator plus announcements, 60 s cap, drop recordings under 1 s). The owner then added the permission-first rule (D14).

## Scope

**In:**

- A new root-provided service, `VoiceRecorderService`, in `src/services/voice-recorder/voice-recorder.service.ts`. It is exported from the `src/services/index.ts` barrel. It owns:
  - the microphone permission check and the permission-only request on the first press (D14)
  - `getUserMedia` and the `MediaRecorder` lifecycle
  - the 60 s auto-stop and the 1 s minimum
  - releasing the media tracks
  - the latest recording, held in a signal
- A new model, `VoiceRecording`, in `src/shared/models/voice-recording.ts`, exported from the `src/shared/models` barrel. Fields: `blob`, `mimeType`, `durationMs`, `recordedAt: Date`.
- A new standalone component, `VoiceRecordButtonComponent`, in `src/shared/components/voice-record-button/voice-record-button.component.ts`. It has an inline template and inline or co-located SCSS. It owns:
  - the pointer and keyboard hold gesture
  - the red pulsing indicator
  - announcements for screen readers
  - stopping the recording when the component is destroyed
- Template, style, and `imports` changes in `DashboardPageContainer`, limited to placing the button in the last `.submit-row`: `src/modules/dashboard/dashboard/dashboard-page.container.html:70-80`, `.scss:24-39`, and `.ts:40-53`.
- Handling for these cases: permission not yet granted (the first press only requests it), microphone permission denied, API not supported, no device, release outside the button, `pointercancel`, focus loss, the page becoming hidden, and destroy during recording.
- Documentation updates for `knowledge/` and `CLAUDE.md` (see [AC24]).
- Test expectations only. The tester writes the spec files.

**Out (each needs its own spec if wanted):**

- Any UI to list, play back, download, share, or delete a recording.
- Persistence of any kind: IndexedDB, `localStorage`, Cache Storage, the outbox, or upload to Google Drive or Sheets. The recording is lost on reload, and that is intended.
- Speech-to-text, or linking a recording to an expense, the form, or a spreadsheet row.
- More than one recording. Each new valid recording replaces the previous one.
- Any change to the NgRx store: no new actions, reducers, selectors, effects, or state shape.
- Any change to offline or outbox behaviour, OAuth scopes, Google API calls, `SpreadsheetService`, the service worker config, `angular.json`, or `package.json`.
- A failure toast through `operationFailed` / `showFailureToast$`. Microphone failures are logged and announced only (D7).
- Choosing an audio codec or bitrate, and transcoding (D6).
- Showing elapsed or remaining time on screen. Only the 60 s cap is enforced.
- Clearing the recording on logout (D12: the owner chose to keep it).

## Approach

- **Layers.** The work lands in a service (`src/services/voice-recorder/`) and a shared component (`src/shared/components/voice-record-button/`), plus a small change to the dashboard container's template. There are no changes in `src/@state/` and nothing on the sheet layout. There is no remote I/O: nothing leaves the browser, so no effect is needed.
- **Service shape.** Follow `src/services/network-status.service.ts` and `src/services/outbox/outbox-drain-lock.service.ts:39-47`:
  - `@Injectable({ providedIn: 'root' })`
  - feature-detect at call time
  - `log()` on fallback or failure, and never throw into the caller

  Expose read-only signals `status` (`'idle' | 'requesting' | 'starting' | 'recording'`) and `latest` (`VoiceRecording | null`), plus `start()` and `stop()`. Both are idempotent. Read `navigator.mediaDevices` and `globalThis.MediaRecorder` at the moment `start()` is called, not at construction, so specs can stub them.
- **Recording algorithm** (pseudocode, for clarity only):
  - `start()`:
    - If `status` is not idle, do nothing.
    - If `mediaDevices.getUserMedia` or `MediaRecorder` is missing: `log`, report `unsupported`, and stay idle.
    - **Permission check (D14).** Set `status = starting`, then work out the permission state:
      - If the service already holds an in-memory grant (`permissionGranted = true`, set by an earlier successful `getUserMedia` this session), treat it as `granted`.
      - Otherwise, if `navigator.permissions?.query` exists, call `query({ name: 'microphone' })` (a `PermissionName` cast may be needed for the DOM lib types). If it rejects (for example, Firefox versions without `'microphone'`), treat the state as `unknown`.
      - Otherwise, treat the state as `unknown`.
    - If the state is `denied`: `log`, report `denied`, set `status = idle`, and do **not** call `getUserMedia`. The browser will not prompt again, so the user must re-enable the permission in site settings.
    - If the state is `prompt` or `unknown`, this press is **permission-only**:
      - Set `status = requesting` and call `getUserMedia({ audio: true })`. This call shows the browser prompt.
      - On resolve: immediately stop every track, create no `MediaRecorder`, set `permissionGranted = true`, report `permission-granted`, and set `status = idle`. `latest` is unchanged.
      - On reject: same classification as below (D8), `status = idle`.
      - A `stop()` (release) while `requesting` does nothing. The prompt is the browser's, and the press was only ever a permission request. A release during the async `query` in `starting` does not cancel the request either, because the click itself is the request.
    - If the state is `granted`, continue on the record path. A release during `starting` on this path **does** cancel (see below).
    - Record path: request `getUserMedia({ audio: true })` (status stays `starting`).
    - On reject: `log`, report `denied` / `no-device` / `failed` based on the `DOMException` name (D8), and set `status = idle`. A `denied` result also clears `permissionGranted`, so a revoked permission is not trusted again.
    - On resolve, if a stop was requested while starting: stop every track, set `status = idle`, and store nothing.
    - Otherwise:
      - create a `MediaRecorder` over the stream with no `mimeType` option
      - collect chunks from `dataavailable`
      - call `recorder.start()` with no timeslice
      - note the start time
      - set `status = recording`
      - arm a 60 000 ms timer that calls `stop` and reports `limit-reached`
  - `stop()`:
    - If `starting` on the record path, flag the pending start as cancelled. If `starting` while the permission state is still being resolved, or if `requesting`, do nothing (D14).
    - If `recording`: clear the timer and call `recorder.stop()`.
    - On the recorder's `stop` event:
      - stop every track of the stream
      - compute `durationMs`
      - if it is under 1000 ms, drop the chunks and leave `latest` unchanged
      - otherwise set `latest` to a new `VoiceRecording` whose `Blob` is built from the chunks with type `recorder.mimeType`
      - set `status = idle`
      - clear every reference to the recorder, stream, and chunks
  - If `MediaRecorder` throws, or the recorder raises `error`: `log`, stop the tracks, set `status = idle`, and keep the previous `latest`.
- **Outcome reporting.** The service reports an outcome for the component to announce: `permission-granted`, `started`, `saved`, `too-short`, `limit-reached`, `unsupported`, `denied`, `no-device`, or `failed`. How the outcome is delivered is the implementer's choice: a returned `Promise`, or a `lastOutcome` signal. It must be observable even for the auto-stop, which no caller triggers. The service does not own any copy text. It also listens for `document` `visibilitychange` → `hidden` and calls `stop()` (D10).
- **Component.** Follow `src/shared/components/outbox-status/outbox-status.component.ts`: inline template, `inject()`, `MatButtonModule` + `MatIconModule`, `protected` template members. Announce with `LiveAnnouncer` (`@angular/cdk/a11y`), `'polite'`, as `src/@state/outbox.effects.ts:59,135` already does. Copy lives in a `const` in the component file. The gesture works like this:
  - A `pointerdown` from the primary button calls `setPointerCapture` and then `start()`. `pointerup`, `pointercancel`, and `lostpointercapture` all call `stop()`.
  - `keydown` of Space or Enter with `!event.repeat` calls `preventDefault` and then `start()`. `keyup` of the same key and `blur` both call `stop()`.
  - `contextmenu` calls `preventDefault`, so a long press on mobile does not open the context menu.
  - `DestroyRef.onDestroy` calls `stop()`.
  - Listeners go in the template or the `host` object, not in `@HostListener` (`.claude/rules/code-style.md`).
- **Dashboard wiring.**
  - Put `<voice-record-button>` in the same `.submit-row` as the submit button (`dashboard-page.container.html:70-80`), after it in DOM order.
  - Add the component to the container's `imports` (`dashboard-page.container.ts:40-53`).
  - The submit button keeps `flex-grow: 1`. The new button is a fixed 56 × 56 px square, matching `.submit-button`'s `height: 56px` (`dashboard-page.container.scss:36-39`).
  - The container gets no new logic. Note: the dashboard uses Signal Forms, not template-driven forms, and there is no `UIKitModule` (`knowledge/constraints/code-conventions.md`, "Components"). Follow what is actually there.
- **Visual indicator.**
  - Idle: `mic_none` icon.
  - Recording: `mic` icon on a red background with white foreground (for example `#d32f2f`, contrast about 5:1), plus a CSS `@keyframes` pulse on scale or box-shadow.
  - Under `@media (prefers-reduced-motion: reduce)` the pulse is off and the red stays.
  - `starting` and `requesting` (the permission prompt is open) look idle, with `aria-busy="true"`.
  - Style the button against touch side effects with `touch-action: none`, `user-select: none`, and `-webkit-touch-callout: none`.

## Decisions

| Question | Alternatives considered | Choice and reason |
|---|---|---|
| D1. Where the recording lives | NgRx `app` slice; component-local signal; root service signal | **Root service signal.** A `Blob` is not serialisable, so it does not belong in the store. The owner asked for no change to the store shape. A root service outlives the dashboard component (for example, navigating to Statistics and back) and lives until the next reload, which is the "until restart" requirement. |
| D2. Where the gesture logic lives | Inline in `DashboardPageContainer`; separate component | **Separate `VoiceRecordButtonComponent`.** It keeps the container focused on the form. Destroy handling stays self-contained. It can be tested without Store or Signal Forms fixtures. |
| D3. Release outside the button | `document`-level `pointerup` listener; pointer capture | **`setPointerCapture` on `pointerdown`.** Then `pointerup`, `pointercancel`, and `lostpointercapture` all reach the button wherever the finger or cursor ends up, with no global listener to clean up. `pointerleave` does **not** stop the recording: the user can drift off the button while holding. |
| D4. Keyboard hold | Space only; Space + Enter; toggle on click | **Space or Enter held.** `keydown` without `repeat` starts, and `keyup` of the same key stops. `blur` also stops, because focus can leave while a key is down. `preventDefault` on `keydown` stops page scroll on Space. `type="button"` means Enter never submits the form. |
| D5. Button placement | Left of Add Expense; right of Add Expense | **Right of Add Expense, after it in DOM and tab order.** The main action stays first. The square button sits where a right thumb rests. This is easy to reverse if the owner prefers the other side. |
| D6. Audio format | Force `audio/webm;codecs=opus`; negotiate with `isTypeSupported`; browser default | **Browser default** (no `mimeType` option). Store `recorder.mimeType` alongside the `Blob`. Safari/iOS records only `audio/mp4`, so forcing webm would break iOS, which is a primary PWA target. |
| D7. Failure surfacing | Reuse `operationFailed` toast; new snackbar; log + announce | **`log()` + a `LiveAnnouncer` message only.** `operationFailed` would add a new `source` to the store's action surface, which conflicts with "no store change". The owner said any toast is optional and minimal, so none is added. |
| D8. Error classification | Single "failed" bucket; map `DOMException.name` | **Map by name.** `NotAllowedError` / `SecurityError` → `denied`. `NotFoundError` / `OverconstrainedError` → `no-device`. `NotReadableError` or anything else → `failed`. A missing API → `unsupported`. Every case is logged with the raw error. |
| D9. Destroy during recording | Discard the in-flight recording; finalise as if released | **Finalise as if released** (`stop()`, with the same 1 s / keep rule). This is the same code path as a normal release, and the user does not lose audio just because the route changed. The service is root, so the `stop` event still completes after the component is gone. |
| D10. Page hidden during recording | Ignore; stop on `visibilitychange` | **Stop on `visibilitychange` → hidden.** Mobile browsers may suspend capture or fail to deliver `pointerup` after an app switch. Stopping avoids a hot microphone in the background. |
| D11. Repeated `start()` while starting or recording | Restart; queue; ignore | **Ignore.** This covers multi-touch, or Space held while also clicking. Exactly one recorder exists at a time. |
| D12. Clear on logout | Clear `latest` on logout; keep until reload | **Keep until reload.** This is the owner's literal requirement. `AppComponent.logout` (`src/app/app.component.ts:87-90`) does not reload. The owner confirmed on 2026-09-23 that the recording survives logout. This spec does not implement clearing. |
| D14. First press without permission | Start recording as soon as the prompt is answered; request permission on first press and record only on the next hold | **Request only, record on the next hold** (owner's decision). When the permission is not known to be granted, the press calls `getUserMedia` purely to trigger the prompt, then releases the stream at once and records nothing. The user almost always lets go to answer the prompt, so recording straight after it would capture silence or an unintended clip. The Permissions API is used where available to tell `granted` from `prompt`. Elsewhere, an in-memory flag set by the first successful `getUserMedia` stands in, so the second press records. A `denied` state skips `getUserMedia` and just reports `denied`. |
| D13. New dependency / build config | — | **None needed.** `MediaRecorder`, `getUserMedia`, `LiveAnnouncer` (CDK, already used), and the Material `mic` / `mic_none` ligatures (Material Icons font, `src/css/fonts.scss:135-138`) are all available. |

## Risks

- **Permission-only press (D14).** The request path must stop the stream's tracks as soon as `getUserMedia` resolves, or the microphone indicator stays on with nothing recording. The record path's "stop requested while starting" handling ([AC11]) is still needed, because `getUserMedia` stays async even with permission granted. Mixing the two paths up (cancelling a permission request on release, or recording after a request) is the most likely bug.
- **Permissions API coverage.** `query({ name: 'microphone' })` is missing or rejects in some browsers (older Firefox). Those fall back to the in-memory flag, so after every reload their first press is permission-only even if the site already has a persistent grant (the prompt then resolves at once without UI). Accepted as the cost of a single, predictable rule.
- **Leaked tracks.** Every exit path must call `track.stop()` on every track of the stream: normal stop, too short, limit, recorder error, `visibilitychange`, and destroy. A leak keeps the OS microphone indicator lit until reload.
- **Mobile long-press side effects.** Without `touch-action: none`, `contextmenu` suppression, and `-webkit-touch-callout: none`, iOS/Android can start text selection or a callout. They then fire `pointercancel`, which ends the recording early. That is correct handling, but a bad experience.
- **iOS Safari quirks.** The `audio/mp4` output is covered by D6. Safari in standalone PWA mode may ask for microphone permission again on each launch. That is outside our control and should be documented, not worked around.
- **Timer precision.** The 1 s threshold is measured from `recorder.start()` to the recorder `stop` event. A hold of about 1.0 s may fall on either side. That is acceptable. Tests should use values well clear of the boundary, or fake timers.
- **Memory.** The size is bounded by one 60 s clip (roughly 0.5-1 MB of Opus/AAC). Replacing `latest` drops the old reference. There is no `URL.createObjectURL`, so no revocation is needed.
- **Blast radius.** Low. The only shared file changed is the dashboard container's template, SCSS, and `imports`. There is no change to the sheet column layout, row-index arithmetic, date conversion, the store, the outbox, auth, or the service worker. The `.submit-row` flex layout changes. Check that Add Expense still fills the remaining width on a 320 px viewport.
- **Secure context.** `getUserMedia` needs HTTPS or localhost. GitHub Pages and `http://localhost:4200` both qualify. A LAN-IP dev URL does not, and it would take the `unsupported` path. That is correct, but it may confuse someone testing on a phone.
- **Test environment.** Headless Chromium in Vitest may or may not expose a real `mediaDevices`. Specs must stub `navigator.mediaDevices.getUserMedia` and `MediaRecorder` and never touch real hardware.

## Acceptance criteria

**Rendering and wiring**

- [AC1] The last `.submit-row` in `dashboard-page.container.html` contains the Add Expense button followed by `<voice-record-button>`. The rendered control is a `<button type="button">`, 56 × 56 px, with an accessible name of "Hold to record voice note" (via `aria-label`).
- [AC2] Activating the voice button in any way (click, Enter, Space, pointer) never dispatches `AppActions.addExpense` and never calls `onSubmit`.
- [AC3] No file under `src/@state/` changes. The `app` and `outbox` slices are unchanged. `AppState`'s shape is identical before and after.
- [AC4] No change to `SpreadsheetService`, the security services, `ExpAuthInterceptor`, `ngsw-config.json`, `angular.json`, `package.json`, or the OAuth scope constants.

**Service behaviour** (in `voice-recorder.service.spec.ts`, with `getUserMedia` and `MediaRecorder` stubbed)

- [AC5] With microphone permission already granted (Permissions API `granted`, or an in-memory grant), `start()` calls `getUserMedia` with `{ audio: true }`, creates exactly one `MediaRecorder`, and moves `status` from `idle` to `starting` to `recording`.
- [AC6] `stop()` after a simulated 2 s recording sets `latest` to a `VoiceRecording` with a non-empty `blob`, `mimeType` equal to the recorder's `mimeType`, `durationMs` ≥ 1000, and a `recordedAt` `Date`. `status` returns to `idle`.
- [AC7] A second valid recording replaces `latest`. The previous `VoiceRecording` is no longer referenced by the service.
- [AC8] A recording shorter than 1000 ms leaves `latest` exactly as it was, whether `null` or a previous recording, and reports `too-short`.
- [AC9] With fake timers, a recording still active at 60 000 ms stops by itself, keeps the recording, reports `limit-reached`, and returns `status` to `idle`.
- [AC10] After every stop path, `stop()` has been called on every track of the stream: normal, too short, limit, recorder `error`, and `visibilitychange` → hidden.
- [AC11] If `stop()` is called while `status` is `starting` (`getUserMedia` not yet resolved), then once it resolves every track is stopped, no `MediaRecorder` is started, `latest` is unchanged, and `status` is `idle`.
- [AC12] `getUserMedia` rejecting with `NotAllowedError` reports `denied`. `NotFoundError` reports `no-device`. Any other error reports `failed`. Each case calls `log()` with the error, throws nothing, leaves `latest` unchanged, and ends with `status` `idle`.
- [AC13] When `navigator.mediaDevices` or `MediaRecorder` is `undefined`, `start()` reports `unsupported`, calls `log()`, throws nothing, and never calls `getUserMedia`.
- [AC14] `start()` while `requesting`, `starting` or `recording` is a no-op: still one `getUserMedia` call and one recorder. `stop()` while `idle` is a no-op.
- [AC15] Nothing in the service writes to IndexedDB, `localStorage`, `sessionStorage`, Cache Storage, or `HttpClient`. The spec asserts that no `HttpTestingController` request is made during a full record cycle, and the service does not inject `HttpClient` or `Store`.

**Component gesture and indicator** (in `voice-record-button.component.spec.ts`, with the service stubbed or spied)

- [AC16] A primary-button `pointerdown` calls `setPointerCapture` and `start()`. `pointerup`, `pointercancel`, and `lostpointercapture` each call `stop()`. A non-primary `pointerdown` (`button !== 0`) does not start.
- [AC17] `pointerleave` alone does not call `stop()`.
- [AC18] `keydown` of Space or Enter with `repeat: false` calls `start()` and `preventDefault()`. `keydown` with `repeat: true` does not call `start()` again. `keyup` of the same key calls `stop()`. `blur` while recording calls `stop()`.
- [AC19] A `contextmenu` event on the button is `preventDefault`-ed.
- [AC20] While the service `status` is `recording`, the button has a `recording` class (red background, pulse animation), shows the `mic` icon, and has `aria-pressed="true"`. When `idle`, it shows `mic_none`, has no `recording` class, and has `aria-pressed="false"`. The component stylesheet disables the pulse under `@media (prefers-reduced-motion: reduce)`.
- [AC21] `LiveAnnouncer.announce` is called with `'polite'` politeness and these messages:
  - `permission-granted`: "Microphone ready. Press and hold to record"
  - `started`: "Recording"
  - `saved`: "Recording stopped"
  - `limit-reached`: "Recording stopped, 60 second limit reached"
  - `too-short`: "Recording too short, discarded"
  - `denied`: "Microphone permission denied"
  - `unsupported`, `no-device`, and `failed`: "Microphone unavailable"
- [AC22] Destroying the component while `status` is `recording` calls `stop()` exactly once. With the real service and stubbed media, `latest` is set afterwards if the recording lasted ≥ 1 s (D9). No error is thrown after destroy.

**Permission-first press (D14)**

- [AC26] When the Permissions API reports `prompt` (or `query` is missing or rejects) and there is no in-memory grant, `start()` moves `status` to `requesting` and calls `getUserMedia({ audio: true })` once. When it resolves, every track is stopped at once, no `MediaRecorder` is created, `latest` is unchanged, `permission-granted` is reported, and `status` ends `idle`.
- [AC27] `stop()` while `requesting`, or while `starting` before the permission state is known, does not cancel the request. The outcome is the same as [AC26].
- [AC28] After [AC26] resolves, the next `start()` takes the record path of [AC5]: exactly one more `getUserMedia` call and one `MediaRecorder`, ending in `recording`. The same holds without the Permissions API, through the in-memory grant.
- [AC29] When the Permissions API reports `denied`, `start()` reports `denied`, calls `log()`, never calls `getUserMedia`, leaves `latest` unchanged, and ends `idle`. A rejection on the request path is classified as in [AC12] and records nothing. A `NotAllowedError` on the record path clears the in-memory grant, so the next press is permission-only again.
- [AC30] While `status` is `requesting` or `starting`, the button looks idle (`mic_none`, no `recording` class, `aria-pressed="false"`) and has `aria-busy="true"`.

**Quality gates**

- [AC23] `bash scripts/harness.sh`, `npm test`, `npm run lint`, and `npx tsc -b tsconfig.app.json tsconfig.spec.json` all pass. No existing spec is deleted or weakened. The new button has an accessible name, and the white icon on red has a contrast of at least 3:1 (no AXE violations).
- [AC24] Documentation:
  - A new concept, `knowledge/flows/voice-recording.md`, describes the current behaviour in present tense and cites the service, model, and component in `sources`.
  - `knowledge/index.md` (Flows) links to it.
  - `knowledge/references/source-map.md` lists `src/services/voice-recorder/`.
  - `knowledge/flows/add-expense.md` mentions the button in the form section.
  - `knowledge/log.md` gets one entry.
  - `CLAUDE.md` gets a "Things that will surprise you" bullet: the recording is held in memory only, is not in the store, and survives logout but not reload.

**Manual verification** (implementer notes the result in the PR)

- [AC25] On Chromium desktop at `http://localhost:4200/exp-spsh/`:
  - In a fresh profile (or after resetting the site's microphone permission), click the button once. The browser permission prompt appears. Allow it. Nothing is recorded, the mic indicator goes off, and "Microphone ready" is announced.
  - Hold for about 3 s. The button is red and pulsing with the mic icon, and the browser/OS microphone indicator turns off after release.
  - Hold for about 0.5 s. Nothing is stored (a `log()` line confirms the discard).
  - Hold, drag outside the button, then release. The recording stops.
  - Deny permission. The page does not crash, the log overlay shows the error, and the announcement fires.
