# 2026-11-07: Receipt Photo to Split Expenses

**Status:** todo
**Priority:**
**Type:** feature
**Module(s):** client
**Owner:** Oleg
**Created:** 2026-11-07

## Description

A supermarket receipt mixes groceries, household items, and sweets. Splitting it by voice
is tedious. Photo recognition reduces entry effort and improves category accuracy.

**Value:** medium · **Effort:** M · **Idea type:** tracking-friction

## Functional Requirements

- FR1: Show a camera button next to the Dashboard microphone button. Let the user supply one receipt photo.
- FR2: Send the photo to the existing Gemini service with a receipt prompt and the user's category names. Return expenses grouped by category.
- FR3: Show a receipt-only editable review card. Save nothing until the user explicitly confirms. Let the user edit category, amount, comment, and date, remove rows, or cancel the draft.
- FR4: Send accepted expenses through the existing expense and outbox path.
- FR5: Keep the photo only in memory for recognition. Do not store it in browser storage, Google Drive, or the spreadsheet.
- FR6: Use a legible receipt date, otherwise the selected Dashboard date. The date remains editable before save.
- FR7: Keep one active receipt draft, bound to the initiating spreadsheet and person. Invalidate it on context changes and ignore late results after cancellation or navigation.
- FR8: Group paid line totals after discounts by allowed category. Do not count totals, tax summaries, payment, or change as extra purchases. Reject invalid or empty recognition results without saving a partial result.

## Non-Functional Requirements

- Use standard browser input and existing Angular, Material, and Gemini APIs. Keep the Gemini SDK import lazy.
- Keep controls accessible by keyboard and show recognition progress and failures.
- Preserve existing voice and manual entry behavior. Do not add timed outbox holds or voice review.
- Require a selected person and nonempty categories. Use fixed receipt errors and never log raw photo or model response data.

## Acceptance Criteria

- [ ] AC1: A camera control appears next to the microphone and accepts one receipt photo.
- [ ] AC2: A mixed receipt produces grouped expenses using only the current user's categories.
- [ ] AC3: The review card permits editing and removal; no expense is added before explicit confirmation, and repeated confirmation cannot duplicate the batch.
- [ ] AC4: Accepted expenses use the existing outbox and have no image fields.
- [ ] AC5: Cancel, invalid photo, failed recognition, and empty results do not add expenses.
- [ ] AC6: No photo content is persisted or written to logs.
- [ ] AC7: A valid receipt date is used, an absent date falls back to the selected Dashboard date, and the user can change it before save.
- [ ] AC8: A scope change, cancellation, or page destruction prevents late results from adding or displaying a stale draft.
- [ ] AC9: Existing voice and manual-entry tests continue to pass.

## Common Sense Considerations

- Only explicit receipt confirmation submits a draft; the voice flow remains unchanged.
- Recognition uses one photo at a time, and file selection resets so the same photo can be retried.
- The app discloses that the photo is sent to Gemini and is not saved by the app.

## Notes

- Source: `docs/ideas/2026-10-25-spending-expert.md`, idea 17 and referenced idea 4.
- The user authorizes the full ADLC cycle and waives first-message/clean-context stops for all agents. Implementers use `.claude/skills/ub-mode/SKILL.md`.
- The user excludes browser checks and real receipt recognition checks. Use mocked recognition and normal unit tests, lint, typecheck, and build; do not run browser UI inspections or real Gemini requests.
