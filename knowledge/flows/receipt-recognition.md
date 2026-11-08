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
    title: Dashboard receipt lifecycle
---

The camera button beside the microphone opens a native single-photo picker. JPEG, PNG,
WebP, HEIC, and HEIF files up to 10 MB are accepted. The app sends the image to Gemini
and keeps no photo in browser storage, Drive, the spreadsheet, or logs.

Gemini groups paid line totals after discounts into the current categories. The client
rejects malformed, empty, or partially invalid results. A legible receipt date is used;
an absent date uses the Dashboard date captured at selection.

The review card lets the user edit amounts, categories, dates, and comments, remove rows,
or cancel. Only Add expenses sends the draft through ExpensesService and the existing
outbox. Consuming the draft before enqueue prevents repeated confirmation.

The draft belongs to its initiating spreadsheet, person, and category list. Context changes,
cancellation, and page destruction discard it and cancel recognition. Voice entry is unchanged.
