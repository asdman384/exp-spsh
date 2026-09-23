---
type: Glossary
title: Project glossary
description: Terms that mean something specific in this codebase, including the ones whose names are misleading.
tags: [domain, glossary, terminology]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: repo
    resource: ../../src
    title: Whole source tree
---

| Term | Meaning here |
|---|---|
| **spreadsheet** | The single Google Sheets *document* the app is bound to, stored as `spreadsheetId`. |
| **sheet** | A *tab* inside that document, modelled as [`Sheet`](sheet-and-user.md). Never the document itself. |
| **data sheet** | A tab named `data_<person>`; holds one person's expenses. |
| **categories sheet** | The single tab named `categories`, referenced by numeric `categoriesSheetId`. |
| **current / selected sheet** | The data sheet the dashboard reads and writes. `dataSheets.selectedSheetId` holds its **title**, not a number. |
| **`Sheet.id`** | The tab's Google `sheetId` / `gid` (a number). Needed for `batchUpdate` and gviz. |
| **`Category.id`** | An ordering **position**, not a database identifier. |
| **in debt** | Per-expense flag "spent on credit / owed". Persisted as the *amount* in column E, read back as presence. |
| **serial number** | The Sheets date encoding: days since 1899-12-30 plus a fractional day. See [spreadsheet layout](spreadsheet-layout.md). |
| **gviz / tq** | The Google Visualization Query endpoint used for filtered expense reads. See [gviz](../interfaces/gviz-query.md). |
| **outbox** | The IndexedDB-backed queue of `addExpense` writes waiting to be sent. See [write outbox](../architecture/write-outbox.md). |
| **drain / drain pass** | One run through the outbox that sends pending records oldest-first. |
| **Memento** | The one-snapshot holder (`src/shared/helpers`) that optimistic effects use for rollback. |
| **`initialUrlParams`** | The pre-`#` query string (`code`, `state`, `logger`) captured once at startup, before the router drops it. |
| **TOTAL** | A string constant in `src/constants/UI.ts`; the table hides the selection checkbox for rows whose category is `TOTAL`. |
| **aggregator** | A `(Expense[]) => Expense[]` in the statistics page: `groupByCategory` or `filterByCategoryName(name)`. |
| **`log()`** | A **global** installed by `src/logger.ts`, writing to the console and an on-page overlay. Not an import. |
| **playground** | An unguarded sandbox route for trying Angular features; not part of the product. |
| **setup** | The flow that binds a spreadsheet picked through Google Picker, creates the tabs, and applies validations. |
| **popup / redirect strategy** | The two `AbstractSecurityService` implementations. Redirect is wired in `app.config.ts`. |
