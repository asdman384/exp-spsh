# 2026-11-18: Receipt Photo Shortcut

**Status:** todo
**Priority:**
**Type:** feature (tracking-friction)
**Module(s):** client
**Owner:** Oleg
**Created:** 2026-11-18

## Description

Let the user select “Receipt photo” from the installed app icon on Android, take a picture, and review the recognized expenses. The user can start with the receipt in view and skip the camera button on the dashboard.

## Functional Requirements

- Add one web manifest shortcut, “Receipt photo”, that opens an in-app camera view. Use `getUserMedia()` to request the rear camera when available.
- If the shortcut requires sign-in or setup, cancel the photo workflow and continue with the usual sign-in or setup flow.
- Start the preview when the view opens and camera access is granted. Let the user take the photo or cancel. Stop the camera when the user leaves the view.
- Pass the captured image to the existing receipt reader when the selected spreadsheet, sheet, and categories are ready. Use the existing review and confirmation flow to save the expenses.
- If sheet data is still loading after capture, keep one photo in memory and show that the app is waiting. Let the user cancel while waiting. If loading finishes without a usable sheet or categories, explain what is missing and let the user return to the dashboard.

## Acceptance Criteria

- [ ] On a supported Android launcher, a long press on the installed app icon shows “Receipt photo” as the only app-defined shortcut.
- [ ] With the app closed, the user signed in, setup complete, and camera permission granted, selecting the shortcut shows a live preview without a tap inside the app. If permission is required, granting it starts the preview.
- [ ] With the user signed out or setup incomplete, selecting the shortcut starts the required flow without requesting camera access. Completing that flow does not open the camera.
- [ ] Taking a photo starts receipt recognition as soon as the receipt reader is ready. The user can edit the recognized items and confirm them for the selected sheet.
- [ ] Cancelling capture or review saves no expenses. After capture or exit, the app releases the camera.
- [ ] If camera access is denied or the camera is unavailable, the user sees a message and can return to the dashboard.
- [ ] If the user takes a photo while sheet data is loading, recognition starts once when the reader becomes ready. Cancelling before loading finishes discards the photo and prevents recognition.
- [ ] Opening the app from its main icon follows the usual launch flow. The dashboard camera button still opens the native photo picker.

## Common sense considerations

- Use a shortcut URL within the manifest scope that follows the app's hash routing under `/exp-spsh/`.
- Use another available camera if the device has no rear camera.
- Pass an image that meets the existing reader's file type and size limits. Keep the photo out of persistent storage.
- Discard the pending photo if the user changes the selected spreadsheet or sheet. Keep the reader's existing cancellation rules during recognition and review.


## Notes

2026-11-18 — implemented via adlc:implement; checks green.
