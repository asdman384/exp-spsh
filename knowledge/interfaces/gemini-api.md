---
type: Interface
title: Gemini expense recognition
description: Voice notes and receipt photos become expenses through the lazy Gemini SDK, with separate schemas, validation, and cancellation rules.
tags: [interface, gemini, ai, voice, structured-output]
status: draft
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/expense-recognition/expense-recognition.service.ts
    title: ExpenseRecognitionService
  - id: receipt
    resource: ../../src/services/expense-recognition/receipt-recognition.ts
    title: Receipt schema and validation
  - id: spec
    resource: ../../src/services/expense-recognition/expense-recognition.service.spec.ts
    title: ExpenseRecognitionService spec
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.view-model.ts
    title: DashboardPageViewModel
---

`ExpenseRecognitionService.recognize(recording, categories, now)` sends one
[`VoiceRecording`](../flows/voice-recording.md) to Gemini and returns a lazy (`defer`)
`Observable<Array<Expense>>`.[^svc]

# Client and key

- `@google/genai` `GoogleGenAI`, `models.generateContent`, model `gemini-3.5-flash-lite`
  (`GEMINI_MODEL`).
- `apiKey: keys.GGG_KEY` — a separate `keys.json` field, not `API_KEY`
  ([configuration](../operations/configuration-and-secrets.md)). No OAuth scope.
- The SDK uses `fetch`, so [`ExpAuthInterceptor`](http-auth-interceptor.md) never sees it.
- The SDK is loaded by dynamic `import()` on first use and the client cached. The service is in
  the `src/services` barrel, so a static import would put ~390 kB in `main`; only types are
  imported statically.

# Request

- `contents`: one user part, `inlineData` = the `Blob` as base64 with the MIME type stripped of
  parameters (`audio/webm;codecs=opus` → `audio/webm`).
- `systemInstruction`: today (`YYYY-MM-DD` of `now`), the allowed category names, and rules —
  one item per expense; "X, of which Y on B" becomes A = X − Y and B = Y; `date` only for a
  named day; `isInDebt` only for "в долг"; extra detail in `comment`.
- `temperature: 0`, `responseMimeType: 'application/json'`, `responseJsonSchema`
  `{ expenses: [{ amount, category, comment, date, isInDebt }] }`, all required,
  `comment`/`date` nullable, `category` an `enum` of the names (free string when the list is
  empty).

# Response

`response.text` is parsed as JSON. It errors when there is no text (message names the first
candidate's `finishReason`), no `expenses` array, or **no valid item survives**.[^spec]

Per item: `amount` is coerced with `Number` and dropped unless finite and positive and `category` is in the list (when the
list is non-empty). `date` is `now`, or the named day with `now`'s time of day; `comment` is
trimmed and omitted when empty; `isInDebt` is set only when `true`.

# Caller

`DashboardPageViewModel` queues every returned expense through `ExpensesService.add`; a failure
becomes a toast with the raw error ([voice recording](../flows/voice-recording.md#recognition)).[^page]

# Local limits

The recorder limits voice clips to 60 seconds. The voice recognition method has no byte-size
check. Receipt input is limited to 10,000,000 bytes before base64 conversion. Provider quotas,
pricing, and retention policies are external to the code and are not fixed by these limits.

[^svc]: ExpenseRecognitionService
[^spec]: ExpenseRecognitionService spec
[^page]: DashboardPageViewModel

## Receipt images

`recognizeReceipt(photo, categories, fallbackDate)` sends one inline image using the same
client and model. Its separate schema has a nullable receipt date and an array of
`{ category, amount, comment }`. Validation rejects extra fields, duplicate categories,
unknown categories, non-positive or non-finite amounts, invalid calendar dates, and empty
results. A receipt date keeps the fallback time of day; a null date uses the fallback date.
The client rejects the whole result if any row is invalid.

Receipt requests use the SDK `abortSignal`; unsubscribe aborts the request. Input errors use
fixed validation text, and request or response failures use `RECEIPT_ERRORS.recognition`.
Images and raw results are not logged. See [receipt flow](../flows/receipt-recognition.md).
