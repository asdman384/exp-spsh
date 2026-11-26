## TL;DR

- `ExpensesTableComponent` renders both the Month summary and category details. Summary mode adds Share and the previous-month comparison to its existing Material table.
- A category's presence in the selected month controls its color. Its amount can legitimately be zero.
- The page owns checkbox state by category name. Spending follows selection. Debt and shares use all saved entries.
- The existing two-month read covers future-dated entries in the selected month and the December/January boundary.
- A stationary hold enters selection. Vertical scrolling, a short tap, and keyboard activation have distinct outcomes.

## Reference

[Month summary requirements](requirements.md)

## Design Decisions

1. **Summary rows.** Keep the existing `summarizeMonth(...).spending` result shape in `src/modules/dashboard/statistics/statistics-summary.ts:3`. Give its rows a local type with required `category: string`, numeric `amount`, `share`, `delta`, and `previousOnly: boolean`. The existing map union at line 30 contains every category. Set `previousOnly` from `!now.has(category)`. Keep name normalization, signed amounts, zero-denominator handling, and the existing sort. Every saved row counts, including flagged rows.
2. **Calendar and formatting.** The existing range in `statistics-data.service.ts:40` runs from the first day of the previous month through the selected month's end, using local boundaries. Use `monthTabs[(currentMonthIndex + 11) % 12]` from `statistics.container.ts:49` for the comparison label. Reuse the registered Polish locale and Angular number pipe with `1.0-2` for money and `1.0-1` plus a literal percent sign for share (already expressed as a percentage). Render the change sign separately from the formatted magnitude: U+002B for an increase, U+2212 for a decrease. Display a rounded zero as plain `0`.
3. **Shared table.** Use the current `ExpensesTableComponent` in both Statistics branches inside the stable `#summaryTable` animation wrapper. The summary branch binds `dataSource` to `summaryRows()` and passes the previous month tab label through one optional `summaryMonthLabel` input. A supplied label selects the column list `category, amount, share, delta`, prefixed with `select` when `selectable()` is true. Reuse the existing Material category, amount and checkbox column definitions. Add `matColumnDef` entries for `share` and `delta`, with the plain heading `vs <label>`. The default column calculation at `expenses-table.component.ts:51` serves Dashboard and category details. Keep the detail projection, Back action and synchronous View Transition update in the container.
4. **Selection lifetime.** Keep `StatisticsContainer.unchecked` as the source of truth, keyed by normalized category name. Bind `[selected]="checkedRows()"` and `[selectable]="unchecked() !== null"` on the summary instance. Reuse the existing `SelectionModel`, `selected` input effect and Material checkbox column for display. In summary mode emit a synchronous `summarySelectionToggle` user intent from checkbox changes, with the category name for one row or `null` for select-all. The page applies its existing toggle methods. Input synchronization emits no user intent. The existing delayed `selectionChange` output retains its contract for other callers. Enable every actual summary category, including `TOTAL`. Disable an empty header and preserve the indeterminate state for a partial selection.
5. **Navigation and totals.** The context is the tuple of numeric sheet ID, year and zero-based month from the tab event arguments in `statistics.container.ts:89`. Reset selection and close details on an actual context change. Retain selection through Back, repeated emissions, and a reload of the same context. Newly encountered categories start checked. Summary Spending sums checked current amounts, detail Spending sums every current row of that category, and the signed Debt figure sums all flagged current rows. Data status gates totals and the empty message as it does today.
6. **Pointer gesture.** Keep the existing Statistics pointer handlers, capture-phase click listener, 500 ms timer and 8 CSS pixel movement tolerance. Bind the pointer and context-menu events to the summary `<expenses-table>` host. Mark its Material summary rows with `data-category` and track them by normalized category via the public table `trackBy` input. Exclude the whole `mat-column-select` cell from press and drill-down handling. Keep pointer capture, native vertical pan, context-change cancellation and timer cleanup.
7. **One action per gesture.** A short activation anywhere on the row opens details in either mode. A completed hold in default view enters selection once with all categories checked, including the pressed row. In active selection a hold preserves the existing checks. Consume the pointer click from a hold or cancelled movement, including a click after cells shift. Guard the correlated click before it can activate a newly visible control. Clear suppression on the next independent pointer sequence and allow keyboard or assistive activation. Suppress the native touch callout/context menu for a handled row hold only.
8. **Keyboard.** Keep the page's focus-visible `Select categories` button and put the existing category details button inside the shared category cell in summary mode. Give the Material header and row checkboxes accessible names. After keyboard entry, focus the header through `MatCheckbox.focus()` using a view query inside the shared component and a small focus method called by the page. Restore focus to the category button after keyboard Back. Keep the summary's delegated row activation as its single navigation path.

## Files to create/modify

Paths in the first seven rows are relative to `src/modules/dashboard/statistics/`.

| File | Purpose | Change |
| --- | --- | --- |
| `statistics-summary.ts` | Summary model | Typed comparison rows with entry presence |
| `statistics.container.ts` | Page behavior | Keep context, totals, navigation and gesture state. Connect checkbox intent and focus to the shared table |
| `statistics.container.html` | Page markup | Replace the existing summary table markup with the configured `expenses-table` instance |
| `statistics.container.scss` | Page layout | Retain totals, selection entry and transitions. Move cell and row rules into the shared component |
| `statistics-summary.spec.ts` | Aggregation tests | Exact shapes, presence and example totals |
| `statistics-data.service.spec.ts` | Read window tests | Later saved date in a selected month |
| `statistics.container.spec.ts` | Component unit tests | Selection, rendering, input handling and existing navigation coverage |
| `src/shared/models/expense.ts` | Display metadata | Add optional `previousOnly` to `ExpenseTableRow`. The aggregate keeps its required fields |
| `src/shared/components/expenses-table/expenses-table.component.ts` | Table contract | Optional summary label, displayed columns, checkbox intent, tracking and header focus |
| `src/shared/components/expenses-table/expenses-table.component.html` | Material table | Reuse existing column templates and add the two numeric columns |
| `src/shared/components/expenses-table/expenses-table.component.scss` | Table styles | Scope summary layout, colors and touch rules to the summary table |
| `src/shared/components/expenses-table/expenses-table.component.spec.ts` | Table unit tests | Verify summary rendering and checkbox events alongside existing default-mode tests |
| `knowledge/flows/statistics.md` | Feature contract | Describe the shared table and page-owned selection |
| `knowledge/interfaces/expenses-table-component.md` | Shared component contract | Document the summary input, checkbox output, columns and focus behavior |
| `knowledge/domain/expense.md` | Row types | Describe the summary type and detail projection under Schema |
| `knowledge/log.md` | History | Record the shipped feature |
| `package.json`, `package-lock.json` | Application version | One minor increment, 0.16.2 → 0.17.0 |

## Test coverage plan

- Aggregation fixtures distinguish an absent category, a saved zero, and entries that cancel. Keep coverage for signed debt, empty months, absent names, special keys, sort order and zero shares. The example uses Ресторан at 460.1, previous 1026.2, and other current spending of 3002.53.
- The service fixture sets local time to November 22 and includes a saved November 25 expense. Assert the October 1 to December 1 exclusive request bounds and inclusion in November. The existing January rollover and stale-response cases cover the year boundary.
- Shared table unit specs cover summary and default column lists, formatting, previous-only rows, individual and header checkbox intents, and the absence of a user intent when `selected` is rebound. Keep the existing tests for Dashboard rendering, selection and dragging.
- Statistics component specs exercise the real shared table, including headings, keyboard focus, selection persistence and reset, and activation from any summary cell outside the checkbox column. Update assertions that infer detail mode from the mere presence of `expenses-table`. Use the rendered columns or the Back control. Keep existing checks for timing, cancellation, transitions and the carousel.
- Agent verification uses lint, TypeScript, the production build and the pure aggregation spec under Node. Angular's configured unit-test target launches headless Chromium (`angular.json:104–110`). The user owns browser verification and E2E.

## Visual/UX notes

- The default header reads **Category**, **Amount**, **Share**, and **vs Oct** when November is selected with English month tabs. Keep the comparison label plain. Use actual header and data cells, right alignment, tabular figures and nonwrapping numbers. Let category text wrap at spaces or, if necessary, within a long word. At 425 px, Господарські товари must remain fully readable with aligned numbers and no horizontal scroll. Insert the entire checkbox column only in selection mode.
- Use a white row background, standard dark category text, weight 600 for the current amount, and regular-weight `#555` for share and change. Use `#666` for all four text cells on a previous-only row, including the category button. The contrast ratios on white exceed 7.45:1 and 5.74:1 respectively. Preserve the amount weight on muted rows.
- Place the small Spending label directly above the prominent total. Keep Debt and its amount in a smaller adjacent group. Both groups fit on the same line at 425 px for the supplied amounts. Replace the summary-only 191 px amount width, left button reservation, and right spacer with intrinsic numeric columns and compact cell padding. Keep detail styling scoped to that view.

## Verification of the earlier page-owned table

- All six aggregation tests passed in Node. The component and data-service specs passed TypeScript compilation. The configured Angular test target uses Chromium, so these specs were not executed.
- ESLint, TypeScript, and the production build passed. The initial lint run found an existing explicit `any` in `SnowComponent`. The template now reads its four icon names from a typed object.
- The build reported two warnings: the snow component stylesheet exceeds its size budget, and the Gemini SDK uses the CommonJS dependency `p-retry`.
- Independent code review passed after the touch handler was updated to handle a native context menu arriving before the hold timer. Browser checks and E2E remain with the user.

## Implementation Chunks

| # | Chunk | Items | Dependency |
| --- | --- | --- | --- |
| 1 | Summary data and rendering | 6 | Connect the existing summary data to the shared Material table |
| 2 | Selection and release integration | 7 | Use stable rows and the summary/detail boundary from chunk 1 |
| 3 | Unit coverage and verification | 7 | Cover the shared table and its Statistics integration |

### Chunk 1 — Summary data and rendering

- [x] Type the summary rows in `statistics-summary.ts` and set the presence flag during the existing map union per decision 1.
- [x] In `statistics.container.ts`, derive the summary from the service state. Keep detail filtering and descending date order. Derive detail total from those current rows and Debt from all current rows. Remove reliance on the shared table's delayed selection event for totals.
- [x] Replace the summary `<table>` in `statistics.container.html` with `<expenses-table>` configured per decision 3. Keep the existing totals, selection-entry button, detail branch, empty message and transition wrapper.
- [x] Keep the optional animation query on a stable wrapper. Apply the existing straight/reverse classes on drill-down/Back. Change the branch and render synchronously in the transition callback per decision 3. Preserve the synchronous fallback and prevent an obsolete callback from reopening an old category after a tab change.
- [x] Add optional `previousOnly` display metadata to `ExpenseTableRow`. In `ExpensesTableComponent`, implement the optional label and displayed columns per decision 3. Use separate share/delta cells and plain amount in summary mode. Preserve default amount rendering. Render the category button, `data-category`, previous-only class and category tracking only in summary mode.
- [x] Move the summary table rules from `statistics.container.scss` to `expenses-table.component.scss`, scoped to summary mode. Apply the Visual/UX notes to the Material cells, including numeric alignment and category wrapping at 425 px. Keep page header, selection-entry and animation styles in the container.

### Chunk 2 — Selection and release integration

- [x] Add the page-local unchecked-name signal and context comparison per decisions 4–5 in `statistics.container.ts`. Compute summary Spending and header state from summary rows. Preserve the set through details and reset it on a different sheet, year or month.
- [x] Reuse the `select` column and `mat-checkbox` controls per decision 4. Wire `summarySelectionToggle` to the page’s existing individual and select-all actions. Preserve names of unchecked categories through data reloads. Keep the existing selection outputs and toggle behavior for default-mode callers.
- [x] Bind the existing press and context-menu handlers to the shared summary instance per decisions 6–7. Update press and capture-click target checks to exclude the entire checkbox cell and allow category and numeric cells. Keep click suppression ahead of checkbox activation after a hold.
- [x] Replace the page’s native `#selectAll` query with the shared table’s public header-focus method per decision 8. Preserve focus after keyboard Back and ensure a category button click opens details exactly once.
- [x] Update `knowledge/flows/statistics.md` and `knowledge/interfaces/expenses-table-component.md` to document the shared summary mode and selection contract. Check the display metadata description in `knowledge/domain/expense.md`.
- [x] Record the feature in `knowledge/log.md`.
- [x] Run `npm --no-git-tag-version version minor` once for the shipped feature and verify the manifest and both application version fields in the lockfile.

### Chunk 3 — Unit coverage and verification

- [x] Extend `statistics-summary.spec.ts` per Test coverage plan. Include the October-only Медикаменти row at 56, a current zero entry, and a pair that nets to zero. Retain the assertions on all existing row fields.
- [x] Add the November 22/25 fixture to `statistics-data.service.spec.ts`. Assert the full request window and inclusion of the future-dated row in current spending.
- [x] In `expenses-table.component.spec.ts`, verify both column modes, separate localized values, muted rows, `TOTAL`, header states and checkbox intent. Exercise the existing `selected` input with fresh row objects and verify that it produces no `summarySelectionToggle` event.
- [x] Adapt `statistics.container.spec.ts` to the shared summary cells. Retain Ресторан at 460,1 / 13,3% / −566,1, Spending 3 462,63, Debt 241,67, +267, plain zero, and the English November/January headings.
- [x] Update integration selectors for the Material checkboxes and both shared-table branches. Retain clear-all, partial, select-all, subtotal through Back, refreshed row objects, context reset, empty detail, constant shares/Debt and both transition directions.
- [x] Exercise the existing keyboard, tap, hold, movement, cancellation and release-click unit cases against shared summary rows. Cover presses on the Material checkbox label and cell padding, focus on the actual header checkbox, and a fresh tap after a consumed hold.
- [x] Run `npx vitest run --environment node src/modules/dashboard/statistics/statistics-summary.spec.ts` and `node scripts/harness.mjs --lint --typecheck --build` after integration. Record the new results separately from the earlier verification and identify specs verified only by compilation.

## Verification of the shared Material table

- All six aggregation tests passed in Node. Vitest required a retry after Windows denied a temporary cache rename inside the sandbox.
- ESLint, TypeScript, the Angular production build, and formatting checks passed. The shared table, Statistics container, and data service specs passed compilation only. The configured Angular test runner starts Chromium. Browser checks and E2E were excluded at the user's request.
- The shared table stylesheet exceeds its 2 kB warning threshold by 630 bytes. The existing snow stylesheet and CommonJS dependency `p-retry` also produced build warnings.
- Independent code review found no issues in the shared summary mode, default columns, selection, pointer handling, keyboard focus, or navigation.
