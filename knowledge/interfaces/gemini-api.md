---
type: Interface
title: Gemini expense recognition
description: How a voice note becomes Expense objects through the @google/genai SDK - model, key, lazy SDK load, structured-output schema, prompt rules, and client-side validation.
tags: [interface, gemini, ai, voice, structured-output]
status: draft
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/expense-recognition/expense-recognition.service.ts
    title: ExpenseRecognitionService
  - id: spec
    resource: ../../src/services/expense-recognition/expense-recognition.service.spec.ts
    title: ExpenseRecognitionService spec
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.container.ts
    title: DashboardPageContainer
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

Per item: dropped unless `amount` is a positive number and `category` is in the list (when the
list is non-empty). `date` is `now`, or the named day with `now`'s time of day; `comment` is
trimmed and omitted when empty; `isInDebt` is set only when `true`.

# Caller

`DashboardPageContainer` queues every returned expense through `ExpensesService.add`; a failure
becomes a toast with the raw error ([voice recording](../flows/voice-recording.md#recognition)).[^page]

# Limits

At most 20 MB per request including base64 audio; audio costs 32 tokens per second. Free-tier
limits are per project; on the free tier Google may use request data.

[^svc]: ExpenseRecognitionService
[^spec]: ExpenseRecognitionService spec
[^page]: DashboardPageContainer
