# Requirements Review — 2026-11-07

Read-only review by an independent agent. The review scope and receipt date policy require a user decision. No code changed.

## Completeness

- Define one expense per category, using paid line totals after discounts. Do not count subtotal, tax summary, payment, or change as extra purchases.
- Define receipt date versus selected Dashboard date.
- Specify supported image types and maximum size from supported SDK/API behavior.
- Require a selected person and nonempty categories; the current voice schema permits free-form categories when none exist.

## Clarity and Testability

- Verify category validity, grouping, and arithmetic with controlled responses; tests cannot guarantee model accuracy on every receipt.
- Reject malformed objects, invalid amounts or dates, and unknown categories. Do not silently accept partial receipt results.
- Prevent repeated acceptance. `ExpensesService.add()` returns void; do not promise atomic batch persistence or remote delivery.

## Technical Integration

- Bind recognition and review to the initiating spreadsheet and person. Invalidate drafts on context changes and ignore late results after cancellation or navigation.
- Permit one active receipt draft. Disable new selection until review is accepted or cancelled.
- Preserve voice parsing behavior unless the chosen scope explicitly changes it.

## UX and Privacy

- Provide visible progress, retry, labelled keyboard controls, and mobile layout checks.
- Clear the file input and image references after success, failure, or cancellation, including same-file retry.
- State that the photo is sent to Gemini and is not saved by the app; do not claim provider retention behavior.
- Use fixed receipt errors. Do not log raw requests, images, or model response text.

## Source Files

- `src/modules/dashboard/dashboard/dashboard-page.view-model.ts`
- `src/modules/dashboard/dashboard/dashboard-page.container.html`
- `src/modules/dashboard/expenses.service.ts`
- `src/services/expense-recognition/expense-recognition.service.ts`
- `src/services/expense-recognition/expense-recognition.service.spec.ts`
- `src/services/outbox/outbox.service.ts`
- `src/shared/components/voice-record-button/voice-record-button.component.ts`
