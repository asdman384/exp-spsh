---
type: Glossary
title: Project glossary
description: Terms that mean something specific in this codebase, including the ones whose names are misleading.
tags: [domain, glossary, terminology]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: repo
    resource: ../../src
    title: Whole source tree
---

| Term | Meaning here |
|---|---|
| **spreadsheet** | The single Google Sheets *document* the user points the app at. One per installation, stored as `spreadsheetId`. |
| **sheet** | A *tab* inside that document, modelled as [`Sheet`](sheet-and-user.md). Never the document itself. |
| **data sheet** | A tab named `data_<person>`; holds expenses for one person. |
| **categories sheet** | The single tab named `categories`. Referenced by numeric `categoriesSheetId`. |
| **current sheet / selected sheet** | The data sheet the dashboard is reading and writing. Held in the store as `dataSheets.selectedSheetId`, whose value is a **title string**, not a number. |
| **`Sheet.id`** | The Google `sheetId` / `gid` of the tab (a number). Needed for `batchUpdate` and gviz. |
| **`Category.id`** | An ordering **position**, not a database identifier. |
| **in debt** | A per-expense flag meaning "this was spent on credit / is owed". Persisted as the *amount* in column E, read back as presence. |
| **serial number** | The Sheets date encoding: days since 1899-12-30 plus a fractional day. See [spreadsheet layout](spreadsheet-layout.md). |
| **gviz / tq** | The Google Visualization Query endpoint (`/gviz/tq`) used for filtered expense reads with a SQL-like query. See [gviz](../interfaces/gviz-query.md). |
| **TOTAL** | The literal string constant used as a category name for aggregate rows; the table suppresses selection checkboxes for such rows. |
| **aggregator** | A `(Expense[]) => Expense[]` function in the statistics page — either `groupByCategory` or `filterByCategoryName(name)`. |
| **`log()`** | A **global** function installed by `src/logger.ts` that writes to both the console and an on-page overlay. Not an import. |
| **playground** | An unguarded sandbox route for trying Angular features; not part of the product. |
| **setup** | The one-time flow that binds a spreadsheet, creates the tabs, and applies validations. |
| **popup / redirect strategy** | The two `AbstractSecurityService` implementations. Redirect is the one wired in `app.config.ts`. |
