## TL;DR

- Dashboard includes `pending` and `failed` outbox records in its list and totals.
- A queued row has a grey style, a cloud icon, and an optional `enqueuedAt` display field. It has no `localId` field.
- `OutboxService.discard(localId)` becomes public. A swipe on a queued row removes one local record.
- The shared table accepts an optional display field. Statistics keeps its existing data and behavior.
- No new package, service, database format, or remote API endpoint is required. Send rules and the reload flow stay the same.

## Reference

[Requirements](C:/dev/exp-spsh/docs/tasks/todo/2026-11-05-queued-expenses-offline/requirements.md)

Task does not look that simple because the change affects Dashboard calculations, the shared table contract, and the public outbox method. I recommend considering the full `/adlc:plan-deep 2026-11-05-queued-expenses-offline` instead.

The references below describe the source before implementation. Paths are relative to `C:/dev/exp-spsh`.

| Source | Relevant behavior |
|---|---|
| `src/modules/dashboard/dashboard/dashboard-page.view-model.ts:54` | The daily list filters saved expenses by local day. |
| `src/modules/dashboard/dashboard/dashboard-page.view-model.ts:67` | The summary calculates daily, monthly, and signed debt totals. |
| `src/modules/dashboard/dashboard/dashboard-page.view-model.ts:136` | All row deletions currently use `ExpensesService.delete`. |
| `src/@state/app.selectors.ts:11` | `spreadsheetIdSelector` supplies the selected spreadsheet ID. |
| `src/services/outbox/outbox.service.ts:37` | `records` is the existing read-only signal. |
| `src/services/outbox/outbox.service.ts:154` | The private discard method removes one record and reloads storage. |
| `src/shared/components/expenses-table/expenses-table.component.ts:34` | The table accepts expense rows. Its delete output is at line 39. |
| `src/shared/components/expenses-table/expenses-table.component.ts:87` | A swipe emits the original row object. |
| `src/modules/dashboard/dashboard/dashboard-page.container.html:95` | Dashboard uses the shared table with the date column hidden. |
| `src/services/spreadsheet/spreadsheet.service.ts:274` | A saved expense is inserted at row zero. |
| `src/services/spreadsheet/spreadsheet.service.ts:314` | Loads preserve sheet order; they do not sort by expense date. |
| `src/modules/dashboard/dashboard/dashboard-page.view-model.spec.ts:118` | The existing enqueue test uses a service stub that does not publish outbox records. |

## Design Decisions

- A `Store.selectSignal(spreadsheetIdSelector)` value makes the spreadsheet filter reactive. The numeric `expenseModel().sheet.id` identifies the person. No selected person or spreadsheet means no queued rows.
- A Dashboard computed signal selects both outbox statuses for that spreadsheet and person. It maps each expense to an `ExpenseTableRow` with `enqueuedAt` from the record. The shared table component exports this small interface, which extends `Expense` with `enqueuedAt?: number`. The domain model and stored payload stay the same.
- Queued rows precede saved rows. A copy of the selected outbox records is reversed to match insertion at sheet row zero. Saved rows retain their current order. No expense-date sort or separate group is added.
- The daily list filters the combined rows to `[local day start, next local day start)`. Monthly and debt totals filter the combined rows to `[local month start, next local day start)`. Existing formatting, finite-number handling, signed debt, and the no-person placeholder stay the same.
- Presence of `enqueuedAt`, including zero, identifies an unsent display row. Discard resolves a current record by spreadsheet, numeric sheet ID, timestamp, and expense fields. Equal timestamps alone are not unique: `Date.now()` can repeat in a voice batch. Compare the full date value and the other expense fields; if records are identical, remove only the first match in current outbox order. Resolve its existing `localId` only for the discard call.
- A queued row with no current match does not fall through to remote deletion. Saved rows keep the current remote delete path. The public discard method keeps its existing storage-error logging and state behavior. No active-send coordination is added.
- The cloud icon is in the amount cell. It has `role="img"`, `aria-hidden="false"`, and `aria-label="Not sent yet"`. Both outbox statuses have the same grey style. No new error display is added.
- Removal after a successful send can leave a temporary gap before reload. No transition state, saved-row cache, or duplicate suppression is added. `ExpensesService` and Statistics receive no queued data.

## Files to create/modify

All implementation files already exist. This plan is the only file created during planning.

| Path | Purpose | Note |
|---|---|---|
| `src/modules/dashboard/dashboard/dashboard-page.view-model.ts` | Merge and discard | Reactive selection, list, totals, local discard branch. |
| `src/modules/dashboard/dashboard/dashboard-page.container.ts` | Row event type | Use `ExpenseTableRow` for the delete handler. |
| `src/shared/components/expenses-table/expenses-table.component.ts` | Display contract | Export the row interface; preserve optional-field compatibility and existing column keys. |
| `src/shared/components/expenses-table/expenses-table.component.html` | Queued row display | Conditional row class and cloud icon in the amount cell. |
| `src/shared/components/expenses-table/expenses-table.component.scss` | Queued row style | Readable grey text and a small icon. |
| `src/services/outbox/outbox.service.ts` | Public discard | Change visibility only. |
| `src/modules/dashboard/dashboard/dashboard-page.view-model.spec.ts` | List and totals coverage | Add outbox and selector stubs; retain existing tests. |
| `src/modules/dashboard/dashboard/dashboard-page.container.spec.ts` | Event integration | Add outbox and selector stubs; verify queued swipe routing. |
| `src/shared/components/expenses-table/expenses-table.component.spec.ts` | Rendering coverage | Verify icon accessibility, date-hidden display, and row output. |
| `src/services/outbox/outbox.service.spec.ts` | Discard coverage | Direct offline discard, persistence, and storage failure. |
| `CLAUDE.md` | Project rules and behavior | Describe Dashboard's local merge and public discard. |
| `knowledge/architecture/write-outbox.md` | Outbox contract | Document the public discard method and Dashboard consumer. |
| `knowledge/architecture/state-management.md` | Dashboard signals | Describe the combined rows and delete routing. |
| `knowledge/interfaces/expenses-table-component.md` | Table contract | Document optional row metadata and icon rendering. |
| `knowledge/flows/add-expense.md` | Add flow | Describe visibility after local persistence. |
| `knowledge/flows/delete-expense.md` | Delete flow | Separate local discard from saved-row deletion. |
| `knowledge/flows/load-expenses.md` | List and totals | Describe the Dashboard merge and date ranges. |
| `knowledge/flows/offline-and-updates.md` | Offline behavior | Describe queued rows and offline discard. |
| `knowledge/log.md` | Change history | Add one implementation entry. |

## Test coverage plan

Existing tests remain in place. The existing enqueue test can retain its assertions because its stub does not publish queue records. New tests publish records after local persistence and verify the new behavior. Provider setup gains a `selectSignal` stub and an outbox signal where the real view-model is used.

| Area | Cases |
|---|---|
| List | Form and voice expenses appear when records are published; both statuses; restored records; newest additions first; saved order retained; different expense dates do not reorder rows. |
| Filters | Wrong spreadsheet, numeric person ID, day, and month; changes to the spreadsheet signal; no person; local midnight boundaries. |
| Totals | Earlier days affect monthly and debt totals only; later days and other scopes are excluded; signed debt; discard; pending-to-failed keeps the same contribution; existing number formats. |
| Discard routing | Pending and failed rows call local discard only; saved rows call remote delete; absent queued records cause no remote call; equal timestamps with different values select the correct record; identical records remove one record only. |
| Storage | Offline discard survives service reinitialization; connection restoration does not send the removed record; a failed remove logs the error and retains the record. Existing Retry and send-error tests remain unchanged. |
| Send completion | Remove the queued record, then publish the saved row through the existing reload behavior: one normal row and one contribution remain. The intermediate gap is accepted. |
| Table | Grey class and accessible cloud icon for both statuses; icon remains with `showDateCol=false`; saved and Statistics-style aggregate rows have no queued style; swipe preserves row metadata. |

Validation consists of `node scripts/harness.mjs` and a browser check of the local app at `http://localhost:4200/exp-spsh/`. The harness covers lint, type checking, production build, and tests. The visual check covers narrow and wide screens, readable grey text, the hidden date column, offline form entry, discard, reload, and successful send. Voice recognition needs a connection; only its resulting queued expenses are part of the offline display check.

## Visual/UX notes

Queued and saved rows use one table. The cloud icon is small and stays next to the amount. Grey text remains readable; whole-row opacity does not reduce contrast. Swipe keeps the existing threshold and gesture. There is no confirmation, undo, extra group, or new error UI.

## Implementation Chunks

| # | Chunk | Items | Notes |
|---|---|---|---|
| 1 | Add queued rows and local discard | 5 | Existing signals and methods only. |
| 2 | Verify behavior and update documentation | 3 | Depends on chunk 1. |

### Chunk 1 — Add queued rows and local discard

- [x] In `src/shared/components/expenses-table/expenses-table.component.ts`, export `ExpenseTableRow extends Expense` with optional numeric `enqueuedAt`. Use it for row input, delete output, and drag data. Keep domain column keys and compatibility with plain `Expense` rows. Use the row type in `src/modules/dashboard/dashboard/dashboard-page.container.ts` for the delete handler.
- [x] In `src/modules/dashboard/dashboard/dashboard-page.view-model.ts`, inject OutboxService and select `spreadsheetIdSelector` as a signal. Select pending and failed records by spreadsheet and numeric sheet ID. Return none without a selection. Map records to rows with `enqueuedAt`; prepend a reversed copy to saved rows without sorting saved rows or expense dates.
- [x] In `src/modules/dashboard/dashboard/dashboard-page.view-model.ts`, use combined rows for the daily list and summary. Keep local day boundaries and month-start-through-selected-day totals, signed debt, number formats, finite-number handling, and the no-person placeholder. Keep queued data out of `ExpensesService` and Statistics.
- [x] Make `discard(localId)` public in `src/services/outbox/outbox.service.ts`. In Dashboard `deleteExpense`, resolve queued rows by selected spreadsheet, numeric sheet ID, `enqueuedAt`, full date value, amount, category, comment, and debt. Discard one matching record; return if absent. Use remote delete only for saved rows. Preserve existing storage errors and send behavior.
- [x] In `src/shared/components/expenses-table/expenses-table.component.html` and `.scss`, use `enqueuedAt !== undefined` for a readable grey row class and small cloud icon in the amount cell. Give the icon `role="img"`, `aria-hidden="false"`, and `aria-label="Not sent yet"`. Preserve the existing swipe action and date-column behavior.

### Chunk 2 — Verify behavior and update documentation

- [x] Extend the four spec files in the Files table with the Test coverage plan cases. Add reactive spreadsheet and outbox stubs to Dashboard fixtures. Retain working tests and their assertions. Cover timestamp collisions, local-only discard, persistence after reload, storage failure, and final totals after successful send.
- [x] Update `CLAUDE.md` and the seven knowledge concept files in the Files table to describe the implemented behavior in present tense. Add history only to `knowledge/log.md`. Use ASD-STE100 Simplified Technical English and correct source references.
- [x] Run `node scripts/harness.mjs` after the code changes. Check `http://localhost:4200/exp-spsh/` at narrow and wide widths for grey-row readability, icon accessibility with hidden dates, offline form entry, discard, restored records, and normal rows after send. Record results and any blockers; do not declare completion with failed checks.

## Implementation log

- 2026-11-05: Read project rules, requirements, plan, and source files. The user overrides the clean-context rule. Existing staged edits remain in place.
- 2026-11-05: Add behavior tests before implementation for queue display, totals, scope, timestamp collisions, swipe routing, and persisted discard. The first build rejects direct discard calls because the method is private; expose the existing method as planned.
- 2026-11-05: The first test process stalls before build. Stop only the task-owned processes and run with `CI=true` to disable Angular local cache while the user's watch process runs.
- 2026-11-05: No `.claude/repo_config` files or TaskCreate/TaskUpdate tools are available. Use this checklist and the project harness. The crapper, dryer, and mutator tools are unavailable.
- 2026-11-05: Inspect worktrees; only the active checkout exists, so no worktree is safe to remove. Open the local app for visual checks; it requires Google sign-in. Request a signed-in test session while automated work continues.

- 2026-11-05: Confirm the behavior tests fail before the Dashboard implementation: 11 new failures and 9 existing passes. Implement the local merge, totals, full-field discard match, and optional table metadata without changes to remote send rules.
- 2026-11-05: Update CLAUDE.md and all seven planned knowledge concepts; add history only to knowledge/log.md.
- 2026-11-05: The first full harness passes lint, type checking, and build. Two new container tests fail because their fake drag lacks CDK internal state. Use the real CdkDrag directive in those tests; all 315 active tests then pass. The two existing AppComponent tests remain skipped.
- 2026-11-05: The user signs in and authorizes Test for UI checks. With a temporary offline NetworkStatusService value in the local build, add a 12.34 Test expense. Confirm immediate grey display, accessible icon with hidden dates, total updates, and restoration after reload. Inspect 390 px and 1280 px layouts. Screenshots are in tmp/queued-narrow.png and tmp/queued-wide.png.
- 2026-11-05: The user stops UI testing and takes ownership of the remaining checks. Restore NetworkStatusService byte for byte and reset the browser viewport. No further UI tests run. The 12.34 test record (comment: Queued offline test 2026-11-05) remains queued for Test and can send after reload. Discard and send completion have automated coverage; their live UI checks are left to the user.

- 2026-11-05: Final verification after restoration: `CI=true node scripts/harness.mjs` passes lint, type checking, production build, and 315 tests. Two pre-existing AppComponent tests are skipped. Existing build warnings concern the snow stylesheet budget and the Gemini dependency p-retry. `git diff --check` passes. Remaining live UI checks are skipped at the user's request.
- 2026-11-05: Review the final diff and confirm no network-service change remains. All task-owned check processes have ended. Temporary scripts, logs, and screenshots stay in the ignored tmp directory. Commit only implementation files and project knowledge; preserve the user's staged idea, task documents, and index. Do not push.

## Scope note

Task does not look that simple because the change affects Dashboard calculations, the shared table contract, and the public outbox method. I recommend considering the full flow (`/adlc:plan-deep 2026-11-05-queued-expenses-offline` to re-plan, then `/adlc:implement-deep 2026-11-05-queued-expenses-offline`) for any remaining or future work like this.

The task changes 21 files including task documentation. This exceeds the default simple-track threshold of 20 files; the full flow may fit better for similar work.
