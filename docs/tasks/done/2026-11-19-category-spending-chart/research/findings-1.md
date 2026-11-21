## Requirements summary

Setup offers an optional `Обзор` tab for new and existing family spreadsheets. Two selectors control one native Sheets line chart for the six completed calendar months, in order. Purchases come from the selected person’s visible `data_…` tab. The calculation uses category A, amount C and date/time D. The first purchase in any category starts that person’s history. Earlier months, an empty history and an empty selector give blank points. Later months without matching purchases give zero. Setup must support skipped starters, refresh the person list on later visits, preserve owner edits, identify unrelated same-name tabs and recover after an interrupted request.

## Wireframes

None referenced. The original idea is in `docs/ideas/2026-11-19-spending-expert.md`, item 1.

## Knowledgebase

`kbIndexPath` is unavailable. The repository index identifies `knowledge/flows/initial-setup.md`, `knowledge/domain/spreadsheet-layout.md`, `knowledge/domain/category.md` and `knowledge/interfaces/google-sheets-api.md` as the relevant subjects. The repository requires current behavior in concept articles and change history in `knowledge/log.md`.

## Existing patterns

- `src/modules/setup/setup-page/setup-page.container.ts:55,82,132` — both file entry points converge on `setupSpreadsheet(id)`. It sets the active service ID and gets metadata **before** creating the current user’s tab. Obtain report metadata after base tabs exist to include that user.
- `src/modules/setup/setup-page/setup-page.container.ts:107,234,249,254,308` — phase-specific retry, serial category writes, category Skip, publishing categories and Finish. Existing categories, saved starters and skipped starters all reach `ready`. Controls block concurrent handlers.
- `src/modules/setup/setup-page/setup-page.container.ts:270,279,317` — Setup registers visible titles containing `data_`, creates/reuses the exact title `data_${user.name}` and upserts into NgRx. Discover report choices from the selected file and the actual `data_` prefix. A substring match or global accumulated store can include unrelated sheets.
- `src/modules/setup/setup-page/setup-page.container.html:10,16,80,105` — use existing file choices, live progress, explicit non-submit buttons and Finish guard. `src/modules/setup/setup-page/setup-page.container.spec.ts:132,158,188,207,218,284,337,398,482` covers fresh metadata, retries, concurrent guards, cancellation, file changes, skipped categories, lost responses and accessible controls.
- `src/services/spreadsheet/spreadsheet.service.ts:99,122,136,157,283` — `getSpreadsheet` already requests metadata without grid data. The service builds typed Sheets v4 batch requests and uses `ONE_OF_RANGE` on all of `categories!$A:$A`. Existing `addSheet` creates only one grid row in its own request. `addExpense` inserts a new top row before filling A–E.
- `src/services/spreadsheet/expense-row.ts:11,31,52,126` and `src/constants/spreadsheets.ts:1` — A is category, C is numeric amount, D is a numeric serial with a fractional day, E stores a separate debt amount. `categories` and `data_` are existing title constants. All entry methods converge on this layout.
- `node_modules/@maxim_mazurok/gapi.client.sheets-v4/index.d.ts:229,241,557,589,956` — installed native types expose basic line charts, null interpolation, range sources and sheet-scoped developer metadata. `src/services/spreadsheet/spreadsheet.service.spec.ts:66` tests batch payloads with `HttpTestingController`. `e2e/tests/statistics.spec.ts:18` shows an offline browser test using seeded auth and intercepted Google HTTP calls. `e2e/tests/authenticated/settings.spec.ts:3` currently only opens Settings.

## Open gaps

These four items were open at the time of research. See their [current status](#planning-outcome) below. The agreed tab name is `Overview`.

- The project has no report schema, owner marker, native chart builder or report-refresh operation. An atomic `batchUpdate` can create a tab with a caller-assigned unused sheet ID, sheet-scoped developer metadata, selector validations, formulas, formats and a chart. Refresh metadata on retry. Refresh only managed person choices when the report exists. Treat an unmarked occupied title as a recoverable conflict that still permits Finish.
- Define the report’s stable cells, selector defaults, chart source, write mask on refresh, hidden/unrelated-tab filtering and person lookup for names containing apostrophes. Discover report ownership by metadata rather than editable chart titles. If report selectors can move with owner edits, use a stable location such as developer metadata or a named range.
- Use full-column selected-tab references, quote sheet names, bound timestamps by `[month start, next month start)`, and distinguish empty history from a zero total. Category names are case-sensitive in Setup and may contain wildcards. Define literal matching for all supported names.
- Mocks can test request and UI contracts. A disposable real spreadsheet is needed to verify formula parsing across supported locales, rolling month labels in the spreadsheet timezone, true chart gaps from blank formulas, and native dropdowns. Keep this separate from assertions about mocked Sheets behavior.

## Planning outcome

| Research question | Status | Decision or next check |
|---|---|---|
| How does Setup create and recognize the report on retry? | Decided | One batch creates the tab and chart. A sheet tag identifies the report on retry. An occupied title permits Finish. See [decisions 3–4](../impl-plan.md#design-decisions). |
| Which cells and people does Setup manage? | Decided | The selectors start empty. Setup lists visible personal tabs and refreshes only the named roster column. The plan specifies the cell addresses, chart source and handling of apostrophes. See [report layout](../impl-plan.md#spreadsheet-layout) and [decisions 2–7](../impl-plan.md#design-decisions). |
| How do the formulas match purchases and distinguish a blank from zero? | Decided | Match the category literally, including case. Use the full purchase columns and an exclusive next-month boundary. Months before the first purchase stay blank. Later months with no match show zero. See [decisions 6–7](../impl-plan.md#design-decisions). |
| What needs a real Google Sheet? | Verification pending | Chunk 1 checks formula separators in `pl_PL` and `en_US`. Chunk 4 checks the dropdowns, calendar rollover and missing chart points in a disposable sheet. See [implementation chunks](../impl-plan.md#implementation-chunks). |
