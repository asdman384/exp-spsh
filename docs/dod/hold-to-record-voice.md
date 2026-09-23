# Definition of Done — Hold-to-record voice button (`hold-to-record-voice`)

Spec: `docs/specs/hold-to-record-voice.md`
Created: 2026-09-23

Sections 1–3 are ticked by the orchestrator from cited evidence. Section 4 is **human-only** —
no agent may ever tick it.

An item without a concrete evidence pointer (a test name, a command result, a report file)
stays `- [ ]`. "I think it works" is not evidence.

> The first run skipped the tester and reviewer at the requester's request. A follow-up run on
> 2026-09-24 ran `tester`. The reviewer phase is still skipped.

---

## 1. Acceptance criteria

**Placement and isolation**

- [x] [AC1] The last `.submit-row` holds Add Expense followed by `<voice-record-button>`. The rendered control is a `<button type="button">`, 56 × 56 px, with `aria-label` "Hold to record voice note". — covered by `src/modules/dashboard/dashboard/dashboard-page.container.spec.ts::[AC1] rendering and wiring` — passing
- [x] [AC2] Activating the voice button in any way (click, Enter, Space, pointer) never dispatches `AppActions.addExpense` and never calls `onSubmit`. — covered by `src/modules/dashboard/dashboard/dashboard-page.container.spec.ts::[AC2] activating the voice button never submits the form` — passing
- [x] [AC3] No file under `src/@state/` changes, and the `AppState` shape is identical. — covered by `git diff --stat -- src/@state` (empty, 2026-09-24) — passing
- [x] [AC4] No change to `SpreadsheetService`, the security services, `ExpAuthInterceptor`, `ngsw-config.json`, `angular.json`, `package.json`, or the OAuth scope constants. — covered by `git diff --stat -- angular.json package.json ngsw-config.json src/services/spreadsheet* src/services/security* src/@state` (empty) + `git status --short` (no auth/interceptor files) — passing

**Service**

- [x] [AC5] With permission already granted, `start()` calls `getUserMedia({ audio: true })` and creates one `MediaRecorder`. `status` goes `idle` → `starting` → `recording`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC5] starting a recording with permission already granted` — passing
- [x] [AC6] `stop()` after 2 s sets `latest` with a non-empty blob, the recorder's mimeType, `durationMs` ≥ 1000 and a `recordedAt` Date. `status` returns to `idle`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC6] stopping after a 2s recording` — passing
- [x] [AC7] A second valid recording replaces `latest`, and the old one is no longer referenced. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC7] a second valid recording` — passing
- [x] [AC8] A recording under 1000 ms leaves `latest` unchanged and reports `too-short`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC8] a recording under 1000ms` — passing
- [x] [AC9] A recording auto-stops at 60 000 ms, keeps the recording, reports `limit-reached` and returns to `idle`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC9] the 60s cap` — passing
- [x] [AC10] Every stop path stops all tracks: normal, too short, limit, recorder `error`, and `visibilitychange` → hidden. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC10] every stop path releases every track` — passing
- [x] [AC11] `stop()` during `starting` stops all tracks once `getUserMedia` resolves. No recorder starts, `latest` is unchanged, and `status` ends `idle`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC11] stop() while starting on the record path (getUserMedia not yet resolved)` — passing
- [x] [AC12] `NotAllowedError` reports `denied`, `NotFoundError` reports `no-device`, and any other error reports `failed`. Each case calls `log()`, throws nothing, leaves `latest` unchanged and ends `idle`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC12] getUserMedia rejection classification on the record path` — passing
- [x] [AC13] With no `mediaDevices` or `MediaRecorder`, `start()` reports `unsupported`, calls `log()`, throws nothing and never calls `getUserMedia`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC13] unsupported environment` — passing
- [x] [AC14] `start()` while `requesting`, `starting` or `recording` is a no-op, and so is `stop()` while `idle`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC14] repeated start()/stop() calls that must be no-ops` — passing
- [x] [AC15] The service does no persistence and no HTTP, and it does not inject `HttpClient` or `Store`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC15] no persistence and no HTTP` — passing

**Component**

- [x] [AC16] A primary `pointerdown` calls `setPointerCapture` and `start()`. `pointerup`, `pointercancel` and `lostpointercapture` each call `stop()`. A non-primary button does not start. — covered by `src/shared/components/voice-record-button/voice-record-button.component.spec.ts::[AC16] pointer hold gesture` — passing
- [x] [AC17] `pointerleave` alone does not call `stop()`. — covered by `src/shared/components/voice-record-button/voice-record-button.component.spec.ts::[AC17] pointerleave` — passing
- [x] [AC18] Space or Enter `keydown` (not a repeat) calls `start()` and `preventDefault()`. A repeat does not start again. `keyup` of that key calls `stop()`, and so does `blur` while recording. — covered by `src/shared/components/voice-record-button/voice-record-button.component.spec.ts::[AC18] keyboard hold gesture` — passing
- [x] [AC19] `contextmenu` on the button is `preventDefault`-ed. — covered by `src/shared/components/voice-record-button/voice-record-button.component.spec.ts::[AC19] contextmenu suppression` — passing
- [ ] [AC20] While recording: `recording` class (red, pulsing), `mic` icon, `aria-pressed="true"`. While idle: `mic_none` icon, no `recording` class, `aria-pressed="false"`. No pulse under `prefers-reduced-motion`. — covered by `src/shared/components/voice-record-button/voice-record-button.component.spec.ts::[AC20] recording indicator` — passing for class/icon/aria-pressed; the reduced-motion clause is **untested** (only confirmed by reading `voice-record-button.component.scss`; the test builder cannot emulate `prefers-reduced-motion`) — left open
- [x] [AC21] `LiveAnnouncer.announce(..., 'polite')` with the spec's message for each outcome, including "Microphone ready. Press and hold to record" for `permission-granted`. — covered by `src/shared/components/voice-record-button/voice-record-button.component.spec.ts::[AC21] LiveAnnouncer messages` — passing
- [x] [AC22] Destroying the component while recording calls `stop()` once. A recording of ≥ 1 s is kept (D9), and nothing throws after destroy. — covered by `src/shared/components/voice-record-button/voice-record-button.component.spec.ts::[AC22] destroy while recording` — passing

**Permission-first press (D14)**

- [x] [AC26] With permission `prompt` or unknown and no in-memory grant, `start()` goes to `requesting` and calls `getUserMedia` once. On resolve it stops all tracks, creates no recorder, leaves `latest` unchanged, reports `permission-granted`, and ends `idle`. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC26] permission-first press: prompt/unknown state with no in-memory grant` — passing
- [x] [AC27] A release (`stop()`) while `requesting`, or while the permission state is being resolved, does not cancel the request. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC27] stop() cannot cancel a permission request` — passing
- [x] [AC28] After a grant, the next `start()` records: one more `getUserMedia` and one `MediaRecorder`, ending in `recording`. This also works without the Permissions API. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC28] the next start() after a granted permission takes the record path` — passing
- [x] [AC29] Permissions API `denied` → reports `denied`, logs, and never calls `getUserMedia`. Request-path rejections follow AC12. A `NotAllowedError` on the record path clears the in-memory grant. — covered by `src/services/voice-recorder/voice-recorder.service.spec.ts::[AC29] permission denied handling` — passing
- [x] [AC30] During `requesting` or `starting` the button looks idle and has `aria-busy="true"`. — covered by `src/shared/components/voice-record-button/voice-record-button.component.spec.ts::[AC30] requesting/starting look idle but busy` — passing

**Quality gates**

- [x] [AC23] Harness, `npm test`, lint and `tsc -b` all pass, and no existing spec is deleted or weakened. The button has an accessible name, and white on red has ≥ 3:1 contrast. — covered by `bash scripts/harness.sh --all` → lint/typecheck/build/test passed, 24 files passed + 1 skipped (baseline), 312 tests passed + 2 skipped after tester (3 new spec files, no existing spec modified); `aria-label` in `voice-record-button.component.ts`; `#d32f2f` bg / `#fff` in `voice-record-button.component.scss:16-17` ≈ 5:1 — passing (no AXE run; axe check folds into AC25 manual)
- [x] [AC24] Docs: new `knowledge/flows/voice-recording.md`, plus updates to the index, source map, `add-expense.md` and `log.md`, and a new `CLAUDE.md` bullet. — covered by `git status --short`: new `knowledge/flows/voice-recording.md`; M `knowledge/index.md`, `knowledge/references/source-map.md`, `knowledge/flows/add-expense.md`, `knowledge/log.md`, `CLAUDE.md` — passing
- [ ] [AC25] Manual Chromium check: first click only requests permission, then a 3 s hold, 0.5 s discard, drag-out release, and denied permission. — **human-only, moved to section 4**

## 2. Verification layers

- [x] **Lint** — `bash scripts/harness.sh --lint` exits 0 — `bash scripts/harness.sh --all` 2026-09-24: passed
- [x] **Type-check** — `bash scripts/harness.sh --typecheck` exits 0 — `bash scripts/harness.sh --all` 2026-09-24: passed
- [x] **Build** — `bash scripts/harness.sh --build` exits 0 — `bash scripts/harness.sh --all` 2026-09-24: passed
- [x] **Unit tests** — `bash scripts/harness.sh --test` exits 0 — `bash scripts/harness.sh --all` 2026-09-24: passed, no new skipped suites (existing suites only; no new tests this run)
- [x] **Full harness** — `bash scripts/harness.sh --all` exits 0 — `bash scripts/harness.sh --all` 2026-09-24: passed
- Manual check in the running app — applies (a new UI control and microphone access), so it moves to section 4.

## 3. Explicitly out of scope

- [x] Any UI to list, play back, download, share, or delete a recording — grep of new files: no match for `<audio`/`createObjectURL`
- [x] Persistence of any kind (IndexedDB, localStorage, Cache Storage, the outbox, upload to Drive or Sheets) — grep of new files: no match for `localStorage|sessionStorage|indexedDB|caches.|HttpClient`
- [x] Speech-to-text, or linking a recording to an expense, the form, or a row — grep of new files: no match for `SpeechRecognition`; the component touches no form or Store
- [x] More than one recording held at a time — the service holds one `latest` signal
- [x] Any NgRx store change (actions, reducers, selectors, effects, state shape) — `git diff --stat -- src/@state` is empty
- [x] Changes to offline/outbox, OAuth scopes, Google API calls, `SpreadsheetService`, SW config, `angular.json`, `package.json` — `git diff --stat` on those paths is empty
- [x] A failure toast via `operationFailed` / `showFailureToast$` (D7) — grep of new files: no match for `operationFailed`
- [x] Choosing an audio codec or bitrate, or transcoding (D6) — `new MediaRecorder` gets no `mimeType` option (only `VoiceRecording.mimeType` is set, `voice-recorder.service.ts:239`)
- [x] An on-screen elapsed or remaining time — the component template has no timer
- [x] Clearing the recording on logout (D12) — `git diff --stat -- src/app` is empty

## 4. Human-only

- [x] Requested by: Oleg
- [x] DoD approved by: Oleg, 2026-09-23  ← **the gate; nothing past step 2 runs until this is signed**
- [ ] [AC25] Manual check in the running app (`npm run watch` + `npm run serve`, http://localhost:4200/exp-spsh/): with the site's mic permission reset, a first click shows the browser prompt, and after Allow nothing is recorded and "Microphone ready" is announced; then a 3 s hold shows red/pulse and the mic indicator goes off after release; a 0.5 s hold stores nothing; drag-out release stops the recording; denied permission doesn't crash and the error is logged and announced
- [x] D12 decided: keep the recording across logout (Oleg, 2026-09-23)
- [ ] Change reviewed and accepted by: <name>
- [ ] Version bumped in `package.json` if this ships
