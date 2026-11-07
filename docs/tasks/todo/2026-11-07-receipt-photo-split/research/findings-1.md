## Requirements summary

Add a camera button beside the Dashboard microphone. Send one receipt image through the existing Gemini service, map items to the user's categories, and review category totals before writing expenses through the existing outbox. The image remains transient. The scope choice between receipt-only confirmation and all of idea #4 remains pending.

## Wireframes

None referenced. Existing actions occupy one flex row: Add Expense then a 56 × 56 microphone. Add the camera beside it and place the review card after the form, before totals/table. Verify at 320 CSS pixels and enlarged text.

## Knowledgebase

- `knowledge/flows/voice-recording.md`: recording signal, page subscription, loading state, direct enqueue.
- `knowledge/interfaces/gemini-api.md`: lazy SDK import, inline bytes, structured output, categories enum.
- `knowledge/architecture/write-outbox.md`: persist-first enqueue, serial drain, five-field expense payload.
- `knowledge/flows/add-expense.md`: page-scoped signal form and shared `ExpensesService.add` path.
- `knowledge/domain/expense.md`: `Expense` fields are optional because aggregate rows reuse the type; receipt validation needs a stricter boundary.
- Caution: date descriptions in `CLAUDE.md` and `knowledge/flows/add-expense.md` differ from current code. Current view-model retains the selected date during submit and replaces even an explicit date on visible next-day resume. Keep unrelated date behavior unchanged.

## Existing patterns

- `src/modules/dashboard/dashboard/dashboard-page.container.html:85`: action row; microphone at line 96; summary starts at line 100.
- `src/modules/dashboard/dashboard/dashboard-page.container.scss:28`: flex action row with 10px gap; Add Expense grows and has 56px height.
- `src/modules/dashboard/dashboard/dashboard-page.container.ts:39`: view-model is page-scoped; line 71 uses standard Signal Forms; line 82 guards submit.
- `src/modules/dashboard/dashboard/dashboard-page.view-model.ts:81`: local signal state. `saveExpense` at line 132 and `changeSheet` at line 143.
- Same file, line 187: voice recognition uses `switchMap`, category snapshot, global loading action and `takeUntilDestroyed`. Its success subscriber reads the **current** sheet when the response arrives; a receipt path should capture or validate scope to prevent sending a result to a different person.
- `src/services/expense-recognition/expense-recognition.service.ts:42`: existing `recognize` builds `inlineData` and calls `generateContent`.
- Same file, lines 78/106/172: reuse lazy client, response schema, and `FileReader` base64 encoding. A receipt method can share request plumbing and select a receipt prompt without adding dependencies.
- Same file, line 133: current parser casts JSON, coerces amounts with `Number`, and filters invalid rows. Receipt handling should validate unknown data explicitly and avoid silently accepting only part of a receipt.
- `node_modules/@google/genai/dist/genai.d.ts:1413`: SDK blob supports base64 `data` and IANA `mimeType`; `Part.inlineData` at line 12809 accepts it directly.
- `src/modules/dashboard/expenses.service.ts:74`: `add` returns void and delegates to outbox; it gives no persistence acknowledgement.
- `src/services/outbox/outbox.service.ts:113`: add projects only date, amount, category, comment and debt into the queued payload. At line 239 drain selects only pending records.
- `src/shared/models/outbox-record.ts:13`: status currently only `pending | failed`.
- `src/services/outbox/outbox-storage.ts:7`: allowed patches omit payload, release time and group identity.

Tests:

- `src/services/expense-recognition/expense-recognition.service.spec.ts:44`: stub SDK client and assert inline content/schema. Existing cases cover mapping, unknown categories, invalid amounts and empty replies.
- `src/modules/dashboard/dashboard/dashboard-page.view-model.spec.ts:51`: fake Store, signal recorder, fake expense service, fake timers and `TestBed.tick`.
- `src/modules/dashboard/dashboard/dashboard-page.container.spec.ts`: DOM-level form actions, dimensions, mobile-width wrapping, button-not-submit checks.
- `.claude/rules/testing.md`: Angular Vitest runner in headless Chromium.
- `.claude/rules/code-style.md`: signals, standalone components, standard reactive forms, WCAG AA and AXE checks.

Supported browser/API approach:

- Native `<input type="file">` supplies a `File`; `accept` guides file selection, and `capture="environment"` requests the outward-facing camera where supported. Capture support varies, so retain the standard file-picker fallback. No custom camera stream is necessary. [MDN file input](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file), [MDN capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)
- Official Gemini image documentation lists PNG, JPEG, WEBP, HEIC and HEIF MIME types. Use an explicit supported allowlist rather than `image/*` alone. [Gemini image input](https://ai.google.dev/gemini-api/docs/image-understanding?hl=en)
- Size documentation is inconsistent: the indexed image guide says 20MB total request, while a newer official announcement describes increased inline limits with type-specific limits. Do not present 20MB as a verified current universal limit. A conservative **application** cap such as 10,000,000 raw bytes is a valid design choice; its base64 length is exactly 13,333,336 bytes before JSON/prompt overhead. [Image guide](https://ai.google.dev/gemini-api/docs/image-understanding?authuser=108&hl=en), [Google limit announcement](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-new-file-limits/)

## Open gaps

1. **Review scope:** receipt-only confirm can remain page-local, without outbox schema changes. Full #4 requires held records, release timing, group Undo/Edit, reload semantics, storage/API changes and tests that drain cannot send held records.
2. Define receipt date behavior, comments listing constituent items, treatment of unreadable lines/discounts/totals, and category-empty behavior. Prompt must avoid counting tax/payment/receipt totals as additional purchases.
3. Define scope handling for person/spreadsheet/category changes during recognition or review; cancellation and page destruction must suppress stale responses.
4. Clear the file input after selection so the same file can be selected again; do not retain the photo in review state, logs or errors.
5. Prevent duplicate confirmation. With the current void enqueue API, do not claim successful persistence merely because `add` returned.
6. Named ub-mode tools `crapper`, `dryer`, `mutator` are not found on PATH, in `package.json`, `package-lock.json`, or installed package paths. `.claude/skills/ub-mode/README.md` points to `unclebob/{crapper,dryer,mutator}`. No installation or execution attempted.
7. No live Gemini call or actual phone-camera test was performed. Service unit tests can verify request construction and result validation, but cannot establish OCR quality.
