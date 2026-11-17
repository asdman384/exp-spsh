## Requirements summary

Setup gains **Create a new spreadsheet for me** beside **Choose existing**. Creation uses Sheets `spreadsheets.create`, title **Expenses**, current HttpClient authentication, and existing `drive.file` scope. Picker cancellation preserves the current selection. Both paths ensure and format `data_<user.name>` and `categories`, reuse matching tabs, and preserve existing rows. After tab setup, read categories: non-empty results go into app state with no starter writes; empty results offer editable starters; a failed read is an error. Starter names, in order: **Groceries, Eating out, Transport, Home, Health, Clothes, Entertainment, Subscriptions, Gifts, Other**. Support local name edits, additions, and removals; trim names and reject blank or exact duplicate names with visible errors. Explicit acceptance saves the final displayed order with numeric positions starting at zero through existing category service methods. Await all writes and cache the saved result. **Skip** sends no starter writes; an empty draft directs users to Skip. Hide all three existing read-only IDs behind a **details** control; keep progress/errors outside it. Disable conflicting actions during requests. On failure, stop progress, show an error, preserve the draft and returned spreadsheet ID for this visit, and allow retry. Later-stage retry reuses the same spreadsheet. Category retry first reads persisted rows to avoid duplicates or overwrites. An unknown creation result must not trigger an automatic second creation; explain that a file might exist and offer Choose existing. Finish opens the existing dashboard only after tabs and category save/load/Skip complete. Keep the default Google tab, current schema, case-sensitive category identity, existing Categories page, and network-only setup. No new SDK, backend, OAuth scope, drag reorder, or outbox use.

## Wireframes

None referenced.

## Knowledgebase

- `knowledge/flows/initial-setup.md` — current direct service orchestration, Picker cancellation, matching-tab reuse, state actions, dashboard navigation. Update its old single-button/category-reset description.
- `knowledge/flows/manage-categories.md` — category reads use `categories!A:B`; add uses append; position changes use update; name identity is case-sensitive.
- `knowledge/domain/spreadsheet-layout.md` — no headers; five-column data tab, two-column categories tab; position in B has non-negative-number validation.
- `knowledge/architecture/state-management.md` — `storeCategories` updates the store and persists the cache; category intent effects use `exhaustMap`.
- `knowledge/interfaces/http-auth-interceptor.md` — HttpClient gets a bearer token through the registered interceptor; no automatic response retry.
- `knowledge/operations/testing.md` — colocated Vitest specs, standalone TestBed, service HTTP mocks, global `log()` initialization, harness verification; no existing end-to-end test suite.
- `CLAUDE.md` — use supported controls/APIs; update relevant knowledge and CLAUDE.md for feature changes; history belongs only in `knowledge/log.md`; run `node scripts/harness.mjs` after implementation.

## Existing patterns

- `src/modules/setup/setup-page/setup-page.container.ts:21` — existing standalone `SettingsPageContainer`, local signals, FormsModule and installed Material controls; keep setup orchestration here.
- `src/modules/setup/setup-page/setup-page.container.ts:50` — current `checkSetup` Picker flow; cancellation returns `EMPTY` before changing selection.
- `src/modules/setup/setup-page/setup-page.container.ts:77` — current data/category setup uses `forkJoin`; ensure the categories tab exists before data formatting that references its range.
- `src/modules/setup/setup-page/setup-page.container.ts:87` — current completion clears categories; replace this with category read/choice completion.
- `src/modules/setup/setup-page/setup-page.container.ts:91` — service spreadsheet ID and non-hidden data-tab discovery.
- `src/modules/setup/setup-page/setup-page.container.ts:101` — data-tab state actions and existing formatting call.
- `src/modules/setup/setup-page/setup-page.container.ts:116` — categories-tab state action and formatting call.
- `src/modules/setup/setup-page/setup-page.container.ts:130` — metadata load and spreadsheet-ID state action.
- `src/modules/setup/setup-page/setup-page.container.ts:142` — preserve dashboard navigation with `replaceUrl`, merged query parameters, and removal of `state`, `code`, `scope`.
- `src/modules/setup/setup-page/setup-page.container.ts:150` — exact-title matching reuses existing tabs without changing row values; reread metadata on retry so successful prior tab additions are discovered.
- `src/modules/setup/setup-page/setup-page.container.html:11` — existing three read-only fields and action; native `<details>/<summary>` can provide the requested disclosure without a new component.
- `src/modules/setup/setup-page/setup-page.container.scss:1` — current centered column layout and spacing; add a wrapping action group and responsive editor styling.
- `src/services/spreadsheet/spreadsheet.service.ts:25` — existing service owns current spreadsheet ID and HttpClient.
- `src/services/spreadsheet/spreadsheet.service.ts:47` — `updateCategories(Category[])`: PUT `categories!A1:B<n>`, rows `[name,id]`, `RAW`; do not call with an empty list or use it to overwrite previously persisted categories during retry.
- `src/services/spreadsheet/spreadsheet.service.ts:62` — `addCategory(Category)`: POST `categories!A1:B1:append`, `INSERT_ROWS`, `RAW`; suitable for sequential missing-row writes.
- `src/services/spreadsheet/spreadsheet.service.ts:99` — `getAllCategories()`: GET `categories!A:B`, `UNFORMATTED_VALUE`; missing values maps to `[]`, HTTP failures propagate.
- `src/services/spreadsheet/spreadsheet.service.ts:115` — `getSpreadsheet(id)` returns `Observable<gapi.client.sheets.Spreadsheet>`; use installed gapi Sheets types for the new creation response as well.
- `src/services/spreadsheet/spreadsheet.service.ts:129` — `addSheet` creates a one-row tab with requested column count.
- `src/services/spreadsheet/spreadsheet.service.ts:150` — data validations/formats include category reference `=categories!$A:$A`; reuse rather than duplicate requests.
- `src/services/spreadsheet/spreadsheet.service.ts:251` — category-position validation; reuse unchanged.
- `src/services/picker/picker.service.ts:26` — `pickSpreadsheet(): Observable<string | undefined>`; cancellation emits `undefined`.
- `src/services/security/abstract-security.service.ts:11` — existing scope is `drive.file` plus user profile.
- `src/shared/models/category.ts:1` — `Category { name: string; id: number }`; no new category domain type needed.
- `src/@state/app.actions.ts:21` — existing `storeCategories` result action.
- `src/@state/app.reducers.ts:48` — existing category state replacement.
- `src/@state/app.effects.ts:61` — `saveCategories$` persists every `storeCategories` result.
- `src/@state/app.effects.ts:94` — `addCategory$` uses `exhaustMap`; do not dispatch ten concurrent add actions. Setup can call the existing service sequentially and dispatch the completed result.
- `src/@state/app.selectors.ts:28` — existing category selector supports immediate downstream availability.
- `src/services/spreadsheet/spreadsheet.service.spec.ts:1` — HTTP testing pattern: `provideHttpClient(withXhr())`, `provideHttpClientTesting()`, `HttpTestingController`, `verify()` after each test.

## Open gaps

No product questions are open in the requirements. These implementation details need a concrete plan:

- Add `createSpreadsheet()` to the existing service, using the Sheets collection URL and `{ properties: { title: 'Expenses' } }`; there is no existing creation method.
- Define local setup stages, error/retry state, draft state, and a completion guard. Existing state has only “check document” and “finish”.
- Define category reconciliation explicitly: retain the accepted snapshot during a failed save, read persisted rows before retry, preserve saved rows, skip names already present, and append only missing accepted names sequentially. Re-read after completion to populate cached state from persisted rows. Do not treat a retry read failure as empty.
- Define the safe behavior when persisted rows differ from the accepted snapshot; the contract forbids overwriting saved categories, and there is no existing reconciliation helper. Avoid introducing new product features.
- Add a setup component spec; none exists. Cover Picker cancellation, create-versus-pick paths, tab reuse, category read errors, validation, Skip, guarded Finish, busy state, partial/lost-response save retry, preserved file ID, and unknown creation outcome. Extend existing service specs for creation.
- No new package, shared abstraction, effect rewrite, schema migration, or category-page change is needed.
