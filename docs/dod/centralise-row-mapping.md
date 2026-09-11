# Definition of Done — Centralise expense row mapping (`centralise-row-mapping`)

Spec: `docs/specs/centralise-row-mapping.md`
Created: 2026-09-11

---

## 1. Acceptance criteria

- [x] [AC1] `expense-row.ts` declares the column order exactly once, as an ordered `keyof Expense` list (`category`, `comment`, `amount`, `date`, `isInDebt`) — covered by `npx tsc -b tsconfig.app.json tsconfig.spec.json` (a field rename in `expense.ts` must fail this build) — passing (reviewer verified `EXPENSE_COLUMNS = [...] as const satisfies ReadonlyArray<keyof Expense>` in `expense-row.ts`; tsc exit 0)
- [x] [AC2] Column letters, indices, and column count are derived, not re-hand-written — covered by manual inspection of `expense-row.ts` (no second `['A','B','C','D','E']` or literal `5`) — passing (reviewer confirmed letters/indices/count derived via reduce/`String.fromCharCode`, no second hand-written ordering — see `docs/reviews/centralise-row-mapping.md`)
- [x] [AC3] Module has no Angular decorator/`inject()`/`HttpClient`/`Store`/RxJS import, and is not re-exported from `src/services/index.ts` — covered by manual inspection / `npm run lint` — passing (`npm run lint`: "All files pass linting."; reviewer confirmed no re-export in `src/services/index.ts`)
- [x] [AC4] Module exports and `SpreadsheetService` uses the full D1 surface — covered by manual inspection of import sites in `spreadsheet.service.ts` — passing (reviewer confirmed all D1 exports consumed)
- [x] [AC5] `addExpense` builds its cell array via the module's serializer, order driven by the [AC1] list — covered by `spreadsheet.service.spec.ts` `addExpense` suite (existing, unmodified) — passing (`bash scripts/harness.sh` test layer: 49 passed, 2 skipped)
- [x] [AC6] `addExpense` request body byte-identical (5 cells, correct value types, absent `userEnteredValue` when not in debt) — covered by `spreadsheet.service.spec.ts` `addExpense` suite — passing (reviewer re-derived from `git show HEAD:` that absent `userEnteredValue` behaviour is preserved; suite green)
- [x] [AC7] `loadLastExpenses` range resolves to byte-identical `<sheetName>!A1:E<take>` — covered by `spreadsheet.service.spec.ts:101` range assertion — passing (test green, unmodified)
- [x] [AC8] `loadLastExpenses` parser reproduces current field-for-field output (raw pass-through, unguarded date) — covered by `spreadsheet.service.spec.ts` `loadLastExpenses` suite (`values[3]`/`values[4]` assertions) — passing (test green; reviewer confirmed unguarded `getDateFromSerialNumber` call preserved)
- [x] [AC9] `loadExpenses` `tq` literal keeps its text/whitespace; final query contains `select A, B, C, D, E` — covered by `spreadsheet.service.spec.ts:199` — passing (test green; reviewer confirmed template's newline/indentation unchanged, only two fragments interpolated)
- [x] [AC10] `loadExpenses` parser reproduces current field-for-field output (coercions, date null-guard, isInDebt test); JSONP unwrap/`ExpensesDTO` stay in service — covered by `spreadsheet.service.spec.ts` `loadExpenses` suite — passing (test green; reviewer confirmed coercions/guard preserved, `ExpensesDTO`/regex stayed in service)
- [x] [AC11] `setDataSheetFormats` ranges derive column bounds by name, not literal; request body unchanged — covered by manual inspection (no dedicated existing test) — passing with note (reviewer confirmed all 5 bounds still resolve to original `0/1, 2/3, 3/4, 4/5, 3/4`; flagged the in-debt range at `spreadsheet.service.ts:206` uses `EXPENSE_COLUMN_COUNT` directly rather than `EXPENSE_COLUMN_INDEX.isInDebt + 1` — equivalent today, latent risk if a column is appended later, see review)
- [x] [AC12] `setup-page.container.ts:102` uses module's column count instead of literal `5`; line `:117` and rest of file untouched — covered by manual inspection / diff review — passing (`git diff` shows only the import line and the one substitution; `:117` untouched)
- [x] [AC13] Date helpers no longer exist in `spreadsheet.service.ts`, moved unexported into the module unchanged — covered by `spreadsheet.service.spec.ts:126-193` (serial round trip + DST regression) — passing (test green; reviewer confirmed constants/offset/regex moved character-for-character)
- [x] [AC14] `npm test` passes with `spreadsheet.service.spec.ts` unmodified; no `.spec.ts` file added/edited/deleted — covered by `bash scripts/harness.sh --test` — passing (`git diff --stat -- '*.spec.ts'` empty; no untracked `.spec.ts`; 49 passed, 2 skipped — same skip count as before, pre-existing `describe.skip('AppComponent')`)
- [ ] [AC15] Manual smoke run: add/list/stats/delete an expense all behave as before — **human-only, see section 4** (an agent cannot click through the running app)
- [x] [AC16] `npm run lint` and `npx tsc -b tsconfig.app.json tsconfig.spec.json` clean, no new `eslint-disable`, no `any` in the new module — covered by `bash scripts/harness.sh --build` plus explicit lint run — passing (both commands exit 0/silent; grep confirms no `eslint-disable` or `any` added)
- [x] [AC17] Repo-wide search shows no remaining `A1:E`, `A, B, C, D, E`, or 5-element positional row array outside `expense-row.ts` / `.spec.ts` files — covered by grep review — passing (reviewer's repo-wide grep confirmed)
- [x] [AC18] `src/@state/**`, `src/shared/**`, `src/services/index.ts`, `angular.json`, `package.json`, `ngsw-config.json`, `knowledge/**` unchanged; no dependency added — covered by `git diff --stat` review — passing (`git status --porcelain` shows only the three expected files changed plus the new module and the pre-existing unrelated `docs/backend-less-assessment.md`)

## 2. Verification layers

Testing phase is skipped for this run — no new or edited `.spec.ts` files. Existing tests are the regression net and must stay green.

- [x] **Build / type-check** — `bash scripts/harness.sh --build` exits 0 — confirmed by reviewer and by orchestrator's own `bash scripts/harness.sh --all` run (2026-09-11): lint/typecheck/build all "passed"
- [x] **Unit tests** — `bash scripts/harness.sh --test` exits 0, `spreadsheet.service.spec.ts` unmodified and passing, no new skipped suites — confirmed: 49 passed, 2 skipped (same as baseline; skip is pre-existing `describe.skip('AppComponent')`)
- [x] **Full harness** — `bash scripts/harness.sh` exits 0 — orchestrator ran `bash scripts/harness.sh --all` directly: "harness: green" (lint/typecheck/build/test all passed)
- [ ] **Manual check in the running app** — required: the change touches every expense read/write path. Move to section 4 — an agent cannot tick this.

## 3. Explicitly out of scope

Copied from the spec's `Out:` list — confirmed not done, not forgotten.

- [x] Id column and id-based delete (assessment §1 / recommendation 1) — confirmed not touched (`git status`)
- [x] One read path + local cache (§2 / recommendation 5) — confirmed not touched; both read paths and both date encodings remain
- [x] `moveDimension` for category reorder (§6 / recommendation 6) — confirmed not touched
- [x] Schema version marker + migration step in setup (§7 second half / recommendation 7) — confirmed not touched
- [x] Write outbox draining on `online$` (§5 / recommendation 8) — confirmed not touched
- [x] `drive.file` + Picker scope narrowing (§4 / recommendation 9) — confirmed not touched
- [x] New tests (recommendation 10) — testing phase skipped this run — confirmed: no `.spec.ts` file added/edited/deleted
- [x] Categories sheet mapping (`updateCategories`, `addCategory`, `getAllCategories`, `setCategoriesSheetFormats`) — follow-up spec `centralise-category-row-mapping` — confirmed not touched (`git diff` shows no changes to categories code paths)
- [x] Any change to `src/@state/**` — confirmed unchanged (`git status`)
- [x] Fixing the parse divergences between the two read paths (D4) — preserved, not corrected — reviewer re-derived both parsers' divergent behaviour is intact
- [x] Updating `knowledge/domain/spreadsheet-layout.md` — deferred per D10, needs owner decision on write-window — confirmed unchanged; **owner decision still open** (reviewer flagged `knowledge/domain/spreadsheet-layout.md:89-91` is now stale)

## 4. Human-only

No agent ticks anything in this section.

- [x] Requested by: Oleg (isd.dp.ua@gmail.com)
- [x] DoD approved by: <Oleg>, <YYYY-MM-DD>  ← **the gate; nothing past step 2 runs until this is signed**
- [x] Change reviewed and accepted by: <Oleg>
- [ ] Manual smoke run performed (AC15): add/list/stats/delete an expense checked against pre-change behaviour
- [ ] Version bumped in `package.json` if this ships
