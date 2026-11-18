## TL;DR

- Add one Android launcher shortcut, **Receipt photo**, at `./#/dashboard/receipt-photo`. It opens the dashboard in capture mode after the existing guards pass.
- Use the browser camera for the shortcut. Hand one in-memory JPEG to the existing dashboard receipt reader. The main icon and native picker keep their current behavior.

## Reference

[Receipt photo shortcut requirements](requirements.md)

## Design Decisions

- Use a dashboard child route with static route data. Angular already binds route data to component inputs and uses hash URLs (`src/app/app.config.ts:54`, `:57`). The dashboard parent checks login and setup (`src/app/app.routes.ts:13`). Both guards redirect to setup without a return URL (`src/shared/guards/index.ts:11`, `:35`).
- Keep the dashboard page and its receipt button mounted through confirmation. The page provides the reader (`src/modules/dashboard/dashboard/dashboard-page.container.ts:46`), the button connects the sheet and date and owns the review dialog (`src/shared/components/receipt-photo-button/receipt-photo-button.component.ts:69`), and the view model consumes confirmed expenses (`src/modules/dashboard/dashboard/dashboard-page.view-model.ts:107`).
- The native picker requires a tap. A small capture component is needed for automatic preview, frame capture, and stream cleanup. Use the browser media and canvas APIs. Use the store's selected IDs to identify a pending photo while the sheet entity loads (`src/@state/app.selectors.ts:18`). Sheet ID zero is valid.

## Files to create/modify

| Path | Purpose | Change |
|---|---|---|
| src/manifest.webmanifest | Launcher menu | Add one shortcut beside the launch settings at line 8. |
| src/constants/route.ts | Route names | Add the receipt-photo segment. |
| src/modules/dashboard/dashboard.routes.ts | Child routes | Add a capture-mode entry beside the default page at line 9. |
| src/modules/dashboard/dashboard/dashboard-page.container.ts | Route input | Accept the capture flag. |
| src/modules/dashboard/dashboard/dashboard-page.container.html | Receipt entry point | Bind the flag on the button at line 110. |
| src/shared/components/receipt-photo-button/receipt-camera.component.ts | New capture view | Implement preview, capture, pending state, and cleanup. |
| src/shared/components/receipt-photo-button/receipt-photo-button.component.ts | Dialog host | Start capture once in shortcut mode and reuse the recognition and review template at line 26. |
| src/shared/components/receipt-photo-button/receipt-camera.component.spec.ts | New camera tests | Mock media tracks, frame encoding, and store transitions. |
| src/shared/components/receipt-photo-button/receipt-photo-button.component.spec.ts | Entry-point tests | Check shortcut handoff, exit, and normal picker behavior. |
| knowledge/flows/receipt-recognition.md | Feature documentation | Describe both entry points and pending-photo ownership. |
| knowledge/architecture/routing-and-guards.md | Route tree | Document the guarded shortcut and its exit. |
| knowledge/log.md | Change history | Record the shortcut. |

## Test coverage plan

Cover immediate and delayed permission, denial, missing devices, late stream resolution after exit, encoding failure, oversize images, and track cleanup. Exercise capture with ready data, delayed data, missing sheet or categories, sheet ID zero, changed selection, and cancellation during loading or encoding. Repeated readiness events must produce one reader call. Reuse the existing confirmation and cancellation coverage in `src/modules/dashboard/dashboard/dashboard-receipt.spec.ts:76`. Run the project harness.

## Visual/UX notes

Use a muted inline video with autoplay. Enable **Take photo** only when a frame is available. Provide **Cancel** during preview, capture, and waiting. Announce waiting and errors. Give a specific reason when the sheet or categories are missing. Keep a dashboard exit available on failure.

The user performs all browser and Android launcher acceptance checks after implementation. On the installed PWA, these cover the long-press menu, cold launch, camera permission grant and denial, sign-out and incomplete setup, cancellation, review through confirmation, ordinary icon launch, and the dashboard photo picker.

## Implementation Chunks

| # | Chunk | Items | Notes |
|---|---|---|---|
| 1 | Receipt photo shortcut | 6 | Reuse the dashboard reader and review dialog. |

### Chunk 1 — Receipt photo shortcut

- [x] Add the sole “Receipt photo” shortcut in src/manifest.webmanifest with URL `./#/dashboard/receipt-photo` and the existing 96px icon. Add the segment in route.ts and map it in dashboard.routes.ts to DashboardPageContainer with static capture-mode data. Use the existing guarded dashboard parent and ordinary setup redirects.
- [x] Bind the route flag through dashboard-page.container.ts and its template to ReceiptPhotoButtonComponent. Open its dialog once in shortcut mode with the camera view first. Keep the ordinary file input and picker action. Reuse the dialog for recognition, errors, editing, and confirmation. On shortcut dismissal return to the dashboard with replaceUrl.
- [x] In receipt-camera.component.ts, request video with ideal environment facing and audio disabled on entry. Show the live preview and Cancel. Capture one frame as JPEG with canvas.toBlob. Stop every track after frame copy, on error, and on exit, including tracks returned after dismissal. Reject empty or oversized output using RECEIPT_MAX_BYTES and show a dashboard exit.
- [x] In ReceiptCameraComponent, snapshot spreadsheet and selected sheet IDs at capture. Retain one Blob during loading. Discard it on ID change, cancellation, or destruction, and ignore late encoding callbacks. Once loading settles, report missing sheet or categories. When canReadReceipt is true, consume the Blob before calling recognizeReceipt once. Preserve existing reader cancellation and confirmation.
- [x] Add camera lifecycle, readiness, selection-change, and single-handoff cases in receipt-camera.component.spec.ts. Extend receipt-photo-button.component.spec.ts for ordinary picker, automatic shortcut dialog, review, and dashboard exit. Run node scripts/harness.mjs.
- [x] Update knowledge/flows/receipt-recognition.md and knowledge/architecture/routing-and-guards.md with the current launch, permission, pending-photo, and exit behavior. Record the feature in knowledge/log.md.
