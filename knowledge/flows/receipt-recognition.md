---
type: Flow
title: Receipt photo recognition
description: A receipt photo becomes an editable expense draft before explicit confirmation.
tags: [flow, receipt, gemini]
status: stable
sources:
  - id: receipt
    resource: ../../src/services/expense-recognition/receipt-recognition.ts
    title: Receipt contract
  - id: page
    resource: ../../src/modules/dashboard/dashboard/dashboard-page.view-model.ts
    title: Dashboard expense subscription
  - id: reader
    resource: ../../src/shared/components/receipt-photo-button/receipt-reader.service.ts
    title: Receipt draft lifecycle
  - id: review
    resource: ../../src/shared/components/receipt-photo-button/receipt-review.component.ts
    title: Receipt review form
  - id: button
    resource: ../../src/shared/components/receipt-photo-button/receipt-photo-button.component.ts
    title: Receipt selection and review template
---

The installed Android app has one launcher shortcut, **Receipt photo**. It requests camera access and prefers the rear camera. Take photo copies one frame to a JPEG and releases the camera. The dialog keeps the image in memory while sheet data loads. Cancellation or a change to the selected spreadsheet or person discards the image. Missing sheet data or categories produces a message. When the reader is ready, it receives the photo once. Closing the dialog returns to the dashboard.

The camera button beside the microphone opens a native single-photo picker. JPEG, PNG,
WebP, HEIC, and HEIF files up to 10 MB are accepted. The app sends the image to Gemini
and keeps no photo in browser storage, Drive, the spreadsheet, or logs.

Gemini groups paid line totals after discounts into the current categories. The client
rejects malformed, empty, or partially invalid results. A legible receipt date is used;
an absent date uses the Dashboard date captured at selection.

Comments use short, readable names in the language of the category names. One product uses
one simple name. Different products of the same type use a shared product group. Mixed groups
use a short list of group names within the same category expense. Comments omit raw receipt
abbreviations, product codes, and repeated items. If no product is identifiable, the comment
uses the readable store name or an empty string.

The review card lets the user edit amounts, categories, dates, and comments, remove rows,
or cancel. Only Add expenses sends the draft through ExpensesService and the existing
outbox. Consuming the draft before enqueue prevents repeated confirmation.

The draft belongs to its initiating spreadsheet, person, and category list. Spreadsheet, person, or category-list changes, cancellation, and page destruction discard
it and cancel recognition. A date change alone does not discard the draft; the fallback
date stays the value captured at selection.

`ReceiptReaderService` is provided by the Dashboard page. It owns recognition, validation,
the review state, and cancellation. Its signals are read-only. The button connects its date
and person input signals to the service. The service reads categories, loading state, and
spreadsheet selection from the store. A confirmed batch contains its person ID and expenses;
`DashboardPageViewModel` subscribes to `expenses$` and adds each expense through `ExpensesService`.
The stream does not replay a previous batch.

The button, review form, and service share `src/shared/components/receipt-photo-button/`.
The button opens its review template with Angular Material `MatDialog`. The modal stays outside
the Dashboard form, so receipt confirmation cannot submit the manual expense form. Escape and
a backdrop click cancel the draft. Recognition progress and errors appear in the same modal. The button owns
file selection and dialog focus restoration. The review component owns row editing and
validation through a reactive `FormArray`. Its total uses the global `en-US` number locale.
Its required `heading` view query has no matching reference in its own template; the
`#heading` belongs to the button template. Its after-render focus callback can therefore
throw (see [known issues](../constraints/known-issues.md) #34).
