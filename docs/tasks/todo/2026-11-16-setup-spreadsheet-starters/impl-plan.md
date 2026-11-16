## TL;DR

- Add `SpreadsheetService.createSpreadsheet()` through the existing authenticated HttpClient.
- Keep setup orchestration in `SettingsPageContainer`; both file choices use the same tab setup path.
- Save accepted starters with sequential existing `addCategory()` calls; retry reads saved rows before appending missing names.
- Use local signals for stages, draft, pending save, busy state, and errors.
- Use native details and installed Material controls; add setup tests and extend service HTTP tests.

## Reference

[Requirements](C:/dev/exp-spsh/docs/tasks/todo/2026-11-16-setup-spreadsheet-starters/requirements.md).

Scope is FR1–FR9 and AC1–AC11. Requirements stay unchanged. This plan adds no product requirements.

## Design Decisions

1. **Existing structure.** Setup remains in `src/modules/setup/setup-page/setup-page.container.ts:21`; the only new service method is creation in `src/services/spreadsheet/spreadsheet.service.ts:115`. Existing signals, FormsModule, Material buttons/inputs, HttpClient, gapi types, and RxJS meet the task. Local orchestration is needed because existing setup has no category-choice or retry stage; no new shared helper, service, package, effect, or backend is needed.

2. **Creation.** `createSpreadsheet(): Observable<gapi.client.sheets.Spreadsheet>` posts the body in API changes. A returned non-empty ID is retained immediately for this visit and passed to the common setup path. Creation does not open Picker or remove Google's default tab. A failed request without a usable ID shows that a file might exist and offers Choose existing; no automatic retry or generic Retry may repeat creation. A new explicit create action is still a user choice.

3. **Selection and stages.** Local stage values are `choose`, `tabs`, `categories`, `save`, and `ready`; errors retain the failed stage. Local state also holds the selected ID, draft names, accepted `Category[]` snapshot, busy flag, and visible error text. Only a confirmed new ID resets prior file-specific state. Picker cancellation leaves selection, draft, progress flags, and completion state unchanged. Busy guards apply in handlers as well as disabled controls. RxJS `finalize` stops progress on success, cancellation, and error.

4. **Common tab setup.** For a confirmed ID, set the service ID and dispatch the existing spreadsheet-ID action, then get fresh metadata. Reuse exact-title tabs through `createSheet` (`setup-page.container.ts:150`). Ensure and format `categories` first, then ensure and format `data_<user.name>`, because data validation references categories. Keep category/data sheet state actions and data-tab discovery. Use two category columns and `EXPENSE_COLUMN_COUNT` data columns. Mark each tab complete only after its formatting succeeds. Retry fetches metadata again for the same retained ID, so already-created tabs are reused and expense rows are preserved.

5. **Category choice.** After both tabs complete, `getAllCategories()` (`spreadsheet.service.ts:99`) decides the path. Non-empty rows are dispatched with `storeCategories` and enable Finish without starter writes. Empty rows expose a local draft in this order: Groceries, Eating out, Transport, Home, Health, Clothes, Entertainment, Subscriptions, Gifts, Other. Read errors leave Finish disabled and do not expose starters as an empty-sheet fallback. Retry retains any draft already shown for that file.

6. **Draft validation.** Names remain local through edits, additions, and removals. Explicit acceptance trims every name, rejects empty names and exact case-sensitive duplicates, and displays the error beside the editor. The accepted snapshot maps displayed order to `{ name, id: index }`, starting at zero. An empty draft disables acceptance and displays “Use Skip to continue without categories.” No empty update request is sent.

7. **Save and retry.** Use existing `addCategory()` (`spreadsheet.service.ts:62`) with RxJS `concatMap`, one accepted row at a time. The snapshot stays fixed once saving starts, including after failure, so retry cannot rename already-saved categories. Before every save attempt, read persisted categories; a read error stops the attempt. Skip exact names already present and append only missing snapshot rows in snapshot order with their original positions. Existing rows and positions are never rewritten or deleted, including rows that differ from the snapshot. After all pending writes, read categories again and dispatch that result before enabling Finish. A partial failure or lost response preserves the snapshot; retry repeats the read and appends only missing names. A failed final read retries this same path. This is visit-local recovery, not a concurrent-editor transaction.

8. **Completion and Skip.** Skip is available only for the empty-sheet draft before acceptance; it writes nothing, stores an empty category result, and marks the stage ready. After a save starts, retain the draft as read-only and offer Retry on failure; Skip must not falsely report an empty sheet after partial saving. Finish is enabled only when both tab flags are complete, stage is ready, and busy is false. Guard its handler too. Keep the dashboard navigation at `setup-page.container.ts:142`, including replaceUrl and OAuth query cleanup. Remove the unconditional category reset at line 87; `storeCategories` already persists the cache through `src/@state/app.effects.ts:61`.

9. **Errors.** Each creation, metadata/tab, category-read, and category-save failure has visible stage-specific text outside details. Known-ID failures show Retry for that stage and retain the ID/draft. An unknown creation outcome instead says “A spreadsheet might have been created. Use Choose existing to find it.” Network errors use these same paths; setup does not use the expense outbox or new OAuth scopes.

## Files to create/modify

Paths are relative to `C:/dev/exp-spsh`.

| Path | Purpose | Note |
|---|---|---|
| `src/services/spreadsheet/spreadsheet.service.ts` | Add creation | Reuse HttpClient and installed response type |
| `src/modules/setup/setup-page/setup-page.container.ts` | Setup flow and draft | Local stages, sequential writes, recovery, completion |
| `src/modules/setup/setup-page/setup-page.container.html` | Choices and editor | Details, labels, errors, disabled states |
| `src/modules/setup/setup-page/setup-page.container.scss` | Responsive layout | Wrapping actions and bounded editor width |
| `src/services/spreadsheet/spreadsheet.service.spec.ts` | Creation HTTP coverage | Extend existing tests |
| `src/modules/setup/setup-page/setup-page.container.spec.ts` | New setup coverage | Standalone TestBed with service/Store mocks |
| `CLAUDE.md` | Feature summary | Brief setup description |
| `knowledge/flows/initial-setup.md` | Current setup contract | Replace old flow and failure description |
| `knowledge/interfaces/google-sheets-api.md` | Creation call | Request and response |
| `knowledge/operations/testing.md` | Coverage inventory | Include setup and creation tests |
| `knowledge/log.md` | Change history | Dated implementation entry |

## API changes

The new client method calls the standard Sheets API; no application endpoint changes.

| Method | URL | Request | Response |
|---|---|---|---|
| POST | `https://sheets.googleapis.com/v4/spreadsheets` | `{ properties: { title: 'Expenses' } }`; existing API key query convention and HttpClient bearer authentication | `gapi.client.sheets.Spreadsheet`; retain `spreadsheetId` |

Google documents this endpoint and its existing `drive.file` scope in [spreadsheets.create](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/create).

Existing getSpreadsheet, addSheet, formatting, getAllCategories, and addCategory calls keep their contracts. Category rows remain name in A and numeric position in B; no schema migration applies.

## Test coverage plan

Extend the service spec's HttpTestingController pattern at `spreadsheet.service.spec.ts:1` to check the creation URL, POST body, response mapping, and error propagation without automatic retries.

The new setup spec uses standalone TestBed, stubbed Store selectors/dispatch, Router, security user stream, Picker, and SpreadsheetService. Initialize global log as described in `knowledge/operations/testing.md`. Deferred Subjects expose request-in-progress states.

Coverage includes both file choices; Picker cancellation with an existing selection and draft; creation without Picker; retained IDs; fresh metadata on retry; matching-tab reuse; category-before-data formatting; preservation of existing expense/category rows; non-empty and empty category reads; read failure; exact starter order; trimming; case-sensitive duplicates; add/remove/edit; empty draft; Skip without writes; sequential saves and positions; partial and lost-response recovery; persisted rows that differ from the snapshot; failed retry/final reads; cache publication before Finish; disabled and guarded actions; unknown creation outcomes; and dashboard navigation.

DOM checks cover default-hidden read-only IDs, details toggling, visible labels/errors/progress, and editor state. Manual browser checks cover narrow-screen wrapping, horizontal overflow, keyboard use, and first-expense category availability. Use existing Vitest and manual checks; no new end-to-end framework.

## Visual/UX notes

Both exact labels “Create a new spreadsheet for me” and “Choose existing” share a wrapping action group. Starter inputs have visible labels, plus Add category, labeled Remove actions, Save categories, and Skip. Buttons inside the form use explicit button types. Validation errors and request errors are visible and associated with their controls where applicable.

Native `<details><summary>Details</summary>…</details>` contains all three current read-only ID fields and starts closed. Progress and errors remain outside it. Retry appears for a failed known-file stage. Finish reflects the completion guard. Use the existing spacing and Material controls; no drag reorder or custom disclosure component.

## Implementation Chunks

| # | Chunk | Items | Notes |
|---|---|---|---|
| 1 | Creation and tab setup | 4 | Service API before component integration |
| 2 | Category flow and setup UI | 7 | Uses the common setup path |
| 3 | Tests and verification | 7 | Verifies the completed flow and updates documentation |

### Chunk 1 — Creation and tab setup

- [x] Add `createSpreadsheet()` to `spreadsheet.service.ts` with the API changes contract, existing HttpClient authentication, installed gapi response type, and no automatic retries.
- [x] Replace the two-state setup flow in `setup-page.container.ts` with the local state and guarded handlers in Design Decisions 2–3; retain returned IDs immediately and preserve state on Picker cancellation.
- [x] Implement the common metadata, category-tab, and data-tab sequence in `setup-page.container.ts` per Design Decision 4, preserving existing state actions, matching-tab reuse, formats, and row values.
- [x] Implement stage errors, busy finalization, and known-ID tab retries per Design Decisions 3 and 9; unknown creation outcomes must not invoke another creation through Retry.

### Chunk 2 — Category flow and setup UI

- [x] Add the post-tab category read and starter initialization to `setup-page.container.ts` per Design Decision 5; replace unconditional category clearing with the appropriate loaded or saved result.
- [x] Add local draft editing, additions, removals, trimming, validation, and accepted snapshot creation in `setup-page.container.ts` per Design Decision 6.
- [x] Add sequential existing-service category writes, persisted-row reconciliation, final read, and failure retention in `setup-page.container.ts` per Design Decision 7.
- [x] Implement Skip and guarded Finish in `setup-page.container.ts` per Design Decision 8, including cache publication and existing dashboard navigation.
- [x] Update `setup-page.container.html` with the paired spreadsheet choices, labeled draft controls, visible validation, Save categories, Skip, Retry, Finish, and busy/accepted-snapshot states from Visual/UX notes.
- [x] Wrap the three existing read-only ID fields in native details in `setup-page.container.html`; keep progress and request errors outside, and set explicit button types.
- [x] Update `setup-page.container.scss` for wrapping actions and editor rows, bounded input widths, and narrow-screen use without horizontal scrolling.

### Chunk 3 — Tests and verification

- [x] Extend `spreadsheet.service.spec.ts` with creation HTTP request, typed response, and failure tests from Test coverage plan; preserve all existing tests.
- [x] Create `setup-page.container.spec.ts` with the Test coverage plan fixture and file-choice, cancellation, tab ordering/reuse, known-ID retry, unknown-create, busy-guard, and Finish tests.
- [x] Add setup tests for empty/non-empty/failed reads, exact starter order, draft edits, trimmed validation, case-sensitive identity, empty draft, Skip, and cached categories.
- [x] Add setup tests for sequential writes, zero-based positions, partial success, lost responses, retry-read failure, final-read failure, existing differing rows, and fixed accepted snapshots.
- [x] Add DOM checks for details, read-only IDs, labels, errors, and disabled controls; check narrow layouts, keyboard operation, and first-expense category availability in the browser per Test coverage plan. DOM and category-state tests pass; manual browser checks are skipped at the user's explicit request.
- [x] Update the listed CLAUDE.md and knowledge files to describe the implemented feature in present tense; put implementation history only in `knowledge/log.md`.
- [x] Run `node scripts/harness.mjs` after implementation changes and `npm run format:check`; resolve failures caused by this task, then inspect the final diff for scope and test preservation.
