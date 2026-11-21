## TL;DR

- Setup offers **Add Overview** beside **Finish**. Selecting a file also refreshes the people in its existing report.
- Google Sheets owns the six-month calculation and the embedded line chart. The report reads saved purchases from one personal tab.
- One Sheets batch creates the complete report. A sheet tag identifies it on retry, even after the owner edits the chart title.
- A hidden, named roster column is the only cell range that Setup maintains after creation. The category dropdown reads directly from the family list.
- Acceptance includes a real Sheets check for chart gaps, formula parsing and month rollover. HTTP mocks cover request construction and Setup behavior.

## Reference

[Task requirements and eight acceptance criteria](requirements.md). The Setup entry points converge in `src/modules/setup/setup-page/setup-page.container.ts:132`. The existing one-row tab creator at `src/services/spreadsheet/spreadsheet.service.ts:136` sends its own request. The report needs a larger grid and atomic creation with its chart. Use a report-specific typed request builder alongside this service.

## Design Decisions

1. **Setup lifecycle.** After both base tabs have been formatted, run a report check before loading or resuming categories. Keep the result local to the selected file. A failed report check still allows the category flow to run. After existing categories, starter Save or starter Skip reaches `ready`, the owner can add a missing report or go straight to Finish. A report error has its own Retry.
2. **People.** Read fresh file metadata after base-tab creation and on every report attempt. Take visible grid tabs in spreadsheet order with a title starting with `DATA_SHEET_TITLE_PREFIX` and a nonempty suffix. Exclude the report itself. Store each full suffix as a typed string, including spaces, underscores and apostrophes. The original Setup discovery at `setup-page.container.ts:270` uses a broader substring match and runs before the new tab exists.
3. **Ownership.** On creation, set sheet-level `DOCUMENT` developer metadata with key `exp_spsh.report` and value `category_spending_v1`. Give the roster a workbook named range with ID `exp_spsh_overview_people_v1` and name `ExpSpshOverviewPeople`. On a repeat visit identify the report by its tag. Resolve the reserved column by range ID and verify it is one whole column on that same grid. A missing or invalid roster, ambiguous tags, or a reserved name or ID collision gives a report conflict with no report write. [Sheets developer metadata](https://developers.google.com/workspace/sheets/api/guides/metadata) · [AddNamedRange](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#addnamedrangerequest)
4. **Safe creation and refresh.** If the tag is absent and the title `Overview` is occupied (including a case-only variant), explain the conflict. Otherwise an explicit Add chooses the first unused positive sheet ID and submits the entire creation batch. Refresh writes typed names to the managed column with `updateCells.range` and field mask `userEnteredValue` so obsolete roster entries clear. Append rows to that report first if its grid is too short. Preserve the visible selectors, formulas, chart properties and other cells. A lost response or a racing Add returns through fresh discovery before the next write. [Atomic Sheets batches](https://developers.google.com/workspace/sheets/api/guides/batch)
5. **Selectors.** Both start empty. Use strict `ONE_OF_RANGE` validation with `showCustomUi: true`. Point the person rule at the report's roster column and the category rule at `=categories!$A:$A`, following `spreadsheet.service.ts:157`. Later category additions appear directly in the dropdown. A stale person value left after a tab is hidden, renamed or removed yields blank amounts until a listed person is chosen.
6. **Calendar and history.** Use Sheets date serials throughout. On sheet recalculation, A5 is `EOMONTH(TODAY(),-7)+1`. Each following row uses `EDATE(previous month,1)`. A helper reads the earliest numeric date in the chosen tab's entire D column across all categories. Test roster membership with literal equality, and guard an empty date column with `COUNT` before `MIN`. A missing person, missing reference or empty history gives an empty helper result.
7. **Monthly amount.** Make the reference prefix from the literal `'data_`, the selected name with each apostrophe doubled, and a closing quote and exclamation mark. Use `INDIRECT` for A:A, C:C and D:D on that tab. For each month, leave the amount blank if either input is empty, the history helper is nonnumeric or the earliest date is at or after the next month start. Otherwise sum C for rows with a literal, case-sensitive category match and a date in `[month start, next month start)`. Use native `FILTER` with array `EXACT`, `SUM` and `IFNA(...,0)` for an empty match. For the blank branch use a Sheets blank result, such as `IFERROR(NA())`. Verify the plotted result in Sheets. Full columns include inserts at row 1. Column E of the purchase tab is independent of the calculation. [FILTER](https://support.google.com/docs/answer/3093197?hl=en) · [IFERROR](https://support.google.com/docs/answer/3093304?hl=en)

8. **Formula syntax.** Start implementation with two disposable, authorized test sheets using `pl_PL` and `en_US`. Write `=SUM(1,2)` and `=SUM(1;2)` through `updateCells.userEnteredValue.formulaValue` in separate probes and read `effectiveValue`. Only a numeric 3 counts as success. If both locales accept the same syntax, use it throughout. If the required separators differ, choose the separator from the workbook's locale (decimal comma uses semicolon, decimal point uses comma). Insert it between function arguments only. Keep quoted names and format patterns intact. Record the probe result with the implementation checks.

## Files to create/modify

| Path | Purpose | Change |
|---|---|---|
| `src/services/spreadsheet/category-spending-report.ts` | Report layout and payload | New. Keep report constants, typed create/refresh requests and metadata decisions together. |
| `src/services/spreadsheet/spreadsheet.service.ts` | Sheets transport | Reuse metadata GET and send the report batch to the selected file. |
| `src/modules/setup/setup-page/setup-page.container.ts` | Setup flow | Report status, discovery, Add and retry. |
| `src/modules/setup/setup-page/setup-page.container.html` | Setup controls | Optional action, progress, conflict and error text. Reuse existing styles. |
| `src/services/spreadsheet/spreadsheet.service.spec.ts` | Wire contract | Inspect complete HTTP requests, narrow refresh and failure recovery. |
| `src/modules/setup/setup-page/setup-page.container.spec.ts` | UI and orchestration | Extend existing mocks and cover both entry points and all category paths. |
| `e2e/tests/setup-overview.spec.ts` | Browser flow | New. Use the existing Chromium project and mocked Sheets responses. |
| `knowledge/flows/initial-setup.md` | Setup reference | Document optional creation, automatic refresh and recovery. |
| `knowledge/domain/spreadsheet-layout.md` | Report contract | Document the report grid, formulas, data ownership and example. |
| `knowledge/interfaces/google-sheets-api.md` | REST interface | Document report discovery and the two batch payloads. |
| `knowledge/log.md` | Change history | Record the feature when implemented. |

## API changes

Define `ReportOutcome = 'absent' | 'ready' | 'title-conflict' | 'roster-conflict'` in `category-spending-report.ts`. Expose `syncCategorySpendingReport(spreadsheetId: string, createIfMissing: boolean): Observable<ReportOutcome>` on `SpreadsheetService`. An unrelated occupied tab title yields `title-conflict`. Invalid or ambiguous ownership and reserved-range collisions yield `roster-conflict`. Transport failures use the Observable error channel. Each subscription reads the supplied spreadsheet ID with the existing `getSpreadsheet(id)` (`spreadsheet.service.ts:122`). The response supplies workbook locale, named ranges, sheet properties and sheet-level metadata. Keep the same explicit file ID for the write.

| Operation | Request | Response used |
|---|---|---|
| Discover | `GET /v4/spreadsheets/{id}` with `includeGridData=false` and existing authentication | `gapi.client.sheets.Spreadsheet`. Inspection returns `absent` for a missing report. Conflicts return the specific outcome above. |
| Create | `POST /v4/spreadsheets/{id}:batchUpdate` with typed `requests[]` for `addSheet`, metadata, named range, cells, validation, hidden columns and `addChart` | `BatchUpdateSpreadsheetResponse`. Successful completion maps to `ready`. |
| Refresh | Same POST with the roster-only request from Decision 4 | Same response. Successful completion maps to `ready`. |

## Spreadsheet layout

| Location on Overview | Contents on creation |
|---|---|
| A1:B2 | Labels `Человек` and `Категория` in A. The two adjacent B cells hold the selections. |
| A4:B10 | Headers `Месяц` and `Расходы, zł`. Six ascending month-start dates with format `mmm yyyy` and six blank or numeric amounts with format `#,##0.00 "zł"`. |
| D:D | Hidden column reserved for Setup, one person per row from D1. The named range spans this entire column. |
| E1 | Hidden report helper for the selected person's first purchase date. |
| A12 | Anchor for one embedded `basicChart` of type `LINE`. Its category domain is E4:E10 (month labels formatted from A5:A10), its only series is B4:B10, `headerCount=1`, `interpolateNulls=false`. Use visible point markers for isolated values, a month axis and a left axis titled `Расходы, zł`. |

Create a grid with at least 10 columns and `max(40, people.length)` rows. Only the report has these data and formats. Existing expense and category sheets retain their current schemas. A file with no report requires an explicit Add to adopt this layout. [Native Sheets chart options](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/charts)

## Test coverage plan

- **Setup and wire contract (AC1, 2, 6–8).** Cover new and existing files, category save/skip, both selectors initially blank, hidden and unrelated tabs, a newly created tab, a second file with other people, a new family member, an owner-edited chart, title conflict, moved roster, concurrent Add and lost responses before or after commit. Assert the destination file/column, exact request types and field masks. Confirm report-only failures allow Finish.
- **Calendar and gaps (AC3, 5, 6).** In a disposable sheet, substitute a fixed date for `TODAY()` in the test copy. On 19 Nov 2026 expect May–Oct. On 1 Dec expect Jun–Nov. For a first transport purchase in July and groceries of 80 zł in August, the May–Oct series is blank, blank, 0, 80, 0, 0. Check blank selectors and a person with no purchases. Inspect displayed month labels, numeric zeros and missing chart points.
- **Saved purchases (AC2, 4, 8).** Verify separate totals for two people and an apostrophe in a tab title. Compare `Food`, `food` and a name with a literal `*`. October purchases of 10, 20 and 120 from form, voice and receipt total 150. Setting and clearing E keeps 150. Inserting 5 at row 1 yields 155. Include an October 31 late timestamp and exclude November 1 midnight. Add a category after starter Skip and a person after report creation.
- **Test boundary.** Unit and browser mocks validate Angular behavior and the API payload. Acceptance in disposable Google Sheets checks the actual formulas, dropdowns, chart gaps and owner edits. Exercise `pl_PL` and `en_US` using their existing time zones and formula syntax. Use the observed REST formula syntax for those locales without changing workbook settings. Record actual results separately from mocked checks.

## Visual/UX notes

Show **Add Overview** when the base flow is ready and the report is absent. Use the existing wrapping action styles, live status and non-submit buttons. For `title-conflict`, show “A tab named Overview already exists. You can rename that tab in Sheets, then retry, or select Finish.” For `roster-conflict`, show “Setup could not identify the report’s people list. Check the report in Sheets or select Finish.” Report failures and conflicts have a **Retry report** action. All file-changing actions and Finish wait for an active request to settle. Keep selectors, the six source values and the chart visible in the spreadsheet.

## Implementation Chunks

| # | Chunk | Items | Dependency |
|---|---|---:|---|
| 1 | Report schema and request payloads | 6 | Verifies formula syntax and defines identity and allowed writes. |
| 2 | Sheets service | 4 | Executes the typed payload for the selected file. |
| 3 | Setup and documentation | 5 | Uses the service outcome in both Setup paths. |
| 4 | Tests and acceptance | 5 | Checks the full flow and native Sheets behavior. |

### Chunk 1 — Report schema and request payloads

- [x] Run the two-locale formula probe in Decision 8 on disposable Sheets. Record the numeric results and select the verified argument separator policy for report formulas.
- [x] Define the report identity, grid, selectors, roster and chart ranges in `category-spending-report.ts` per Spreadsheet layout. Reuse the existing personal-tab prefix and category title constants.
- [x] Derive people and report ownership from metadata per Decisions 2–4. Validate the reserved range and choose a free sheet ID only for creation.
- [x] Build the month, first-date and amount formulas per Decisions 5–7. Use typed strings for names, formula values for calculations and explicit date and zł formats.
- [x] Assemble one ordered creation request list with all grid data, marker, named range, dropdowns and the native chart per API changes and Spreadsheet layout.
- [x] Build the narrow roster refresh request list per Decision 4 using the resolved range location and current grid height.

### Chunk 2 — Sheets service

- [x] Add the typed service method from API changes. Reuse `getSpreadsheet(id)` for a fresh read at subscription time and use the same file ID throughout.
- [x] Dispatch discovery results per Decisions 3–4. Return absent or conflict without writing when applicable.
- [x] Submit the selected creation or refresh payload through Angular HttpClient with existing API parameters and authentication. Map success to ready.
- [x] Propagate request failures to Setup. Make every retry perform discovery again, including after an ambiguous response or duplicate-title race.

### Chunk 3 — Setup and documentation

- [x] In `setup-page.container.ts`, run inspection after personal-tab setup and before category resolution. Keep report failures local and proceed with the existing category flow per Decision 1.
- [x] Implement Add and report Retry for the selected file. Remember whether the failed attempt requested creation, reset report state on file changes and preserve it on Picker cancellation.
- [x] Update the Setup template per Visual/UX notes. Reuse the loading guard in both handlers and buttons. Keep Finish available after the base flow completes and report requests settle.
- [x] Update the Setup flow, spreadsheet layout and Sheets API knowledge articles with the implemented behavior, source paths, managed-column boundary and recovery rules.
- [x] Add the feature entry to `knowledge/log.md`.

### Chunk 4 — Tests and acceptance

- [x] Extend `spreadsheet.service.spec.ts` with typed payload and retry tests per Test coverage plan, including metadata, formulas, ranges, conflict, roster-only refresh and both lost-response outcomes.
- [x] Extend `setup-page.container.spec.ts` for both file entry points, category completion paths, distinct title and roster conflict messages, report retry, file switching, busy guards and Finish after an optional report failure.
- [x] Add `e2e/tests/setup-overview.spec.ts` with seeded app authentication and intercepted Sheets requests. Exercise Add after starter Skip, Finish without Add, and recovery of a committed report after a lost response.
- [ ] Run Chromium Playwright and check the 425 × 896 viewport. The user explicitly excluded browser launches for this task. See the browser-free checks below.
- [x] Exercise all eight criteria in disposable Sheets per Test coverage plan. Verify rendered chart gaps and both locales. Record actual results and identify any live checks that lack test-file access.

## Verification on 21 November 2026

| Check | Observed result |
|---|---|
| REST formula syntax | In `pl_PL`, `=SUM(1,2)` returned 1.2 and `=SUM(1;2)` returned 3. Both expressions returned 3 in `en_US`. The report uses semicolons in both locales. |
| Calendar and chart | With a fixed test date of 19 November, the chart displayed May–October. With 1 December, it displayed June–November. The Polish and English exports showed six localized ticks. Sheets dropped the last tick on the numeric date axis even with monthly grouping. Using `TEXT` in hidden E4:E10 kept all six ticks while preserving the numeric dates for calculations. |
| Purchase history | The native chart showed gaps for May and June, zero in July, 80 zł in August and zero in September and October. A new person with one October purchase had a single visible 22 zł point. Empty selectors, a hidden person and empty purchase history yielded six blank amounts. |
| Series formatting | With all amounts initially blank, Sheets discarded the point style and left-axis title. The creation batch supplies one numeric value while adding the chart, then restores the monthly formula before commit. The exported chart showed the left-axis title and the isolated marker on first use. |
| Saved rows | Three October rows of 10, 20 and 120 produced 150 zł with and without the receipt debt. Inserting a 5 zł purchase at row 1 produced 155 zł. An October 31 late transaction was included and November 1 midnight appeared in the next month. The fixtures represented the rows saved by each entry method. |
| Selectors and ownership | A person with an apostrophe, case-sensitive categories and a literal asterisk worked. Categories added after report creation were available immediately. Refresh added a new person, retained the edited chart title and left one chart. A case-insensitive title collision produced no write. |
| Roster growth | Sheets returned the whole-column named range with an explicit end row. Appending rows alone left the old end in place. Refresh expanded a 12-row grid and its range to 13 and wrote the last person's name in row 13. |

All writable checks used disposable native Google Sheets and the e2e credentials. Each test spreadsheet was moved to the trash after its run. The Drive connector found a native workbook titled `Expenses` and no exact match for `Expenses.xlsx`. A read-only sample of the native file confirmed the category column, personal tab and numeric amount and date columns.

- Lint, application/spec/e2e type checks, the production build and formatting of the changed code passed. The independent code review reported no blocking issues.
- Both changed Angular suites passed in jsdom (74 tests). A full jsdom run passed 422 tests, failed 95 and skipped 2. Under the same runner, the baseline at `8445ced` passed 399, failed 95 and skipped 2. The failing test names matched exactly. Both runs also reported two unhandled errors. The baseline includes tests that depend on browser features such as IndexedDB, media devices and layout measurements.
- Playwright discovered all three new scenarios with `--list`. Chromium execution and the 425 × 896 visual check were skipped at the user's request. The optional ADLC pre-run health check was disabled.
