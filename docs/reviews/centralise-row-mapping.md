# Review — Centralise expense row mapping (`centralise-row-mapping`)

Spec: `docs/specs/centralise-row-mapping.md`
DoD: `docs/dod/centralise-row-mapping.md`
Reviewed: 2026-09-11

## Verdict

**approve** (pass with notes).

All 17 agent-checkable acceptance criteria (AC1–AC14, AC16–AC18) are met. AC15 is human-only and
remains unticked — no agent can perform it. The refactor is a genuine relocation: I re-derived
every request body, range string and `tq` fragment from source and found no byte-level change on
the wire, and the two parsers' divergences (D4) are preserved rather than harmonised.

Two **minor** findings and three **nits** are recorded below. None of them blocks merge; the
`EXPENSE_COLUMN_COUNT`-as-`endColumnIndex` one (F1) is worth a follow-up because it slightly
undercuts the future-proofing this refactor exists to deliver.

## Spec compliance

The existing spec file's own `[AC1]`–`[AC4]` markers belong to an **earlier** spec (the in-debt
column work), not this one. The test names below are cited verbatim; do not read their bracketed
tags as this spec's ACs.

| AC | Status | Evidence |
|---|---|---|
| **AC1** — column order authored once, ordered `keyof Expense` list | check | `src/services/spreadsheet/expense-row.ts:11-13`: `const EXPENSE_COLUMNS = ['category','comment','amount','date','isInDebt'] as const satisfies ReadonlyArray<keyof Expense>`. Order matches the spec exactly. The `satisfies` clause does bind: renaming a field in `src/shared/models/expense.ts:1-7` makes the corresponding string literal non-assignable to `keyof Expense` and fails `npx tsc -b`. Type-check verified clean (`tsc-exit:0`). Not exercised by a test — enforced by the compiler. |
| **AC2** — letters/indices/count derived, no second ordering | check | `expense-row.ts:17` (`EXPENSE_COLUMNS.length`), `:23-26` (letters via `String.fromCharCode(65 + index)`), `:28-31` (indices via `reduce`). Grep of the file shows no `['A','B','C','D','E']` and no bare `5`. |
| **AC3** — no decorator / `inject()` / `HttpClient` / `Store` / RxJS; not barrelled | check | `expense-row.ts:1-4` — only imports are the two `///` type references and `Expense` from `src/shared/models`. `src/services/index.ts` is byte-unchanged (`git status`: not listed) and still re-exports only the four injectables. |
| **AC4** — D1 surface exported and used | check (with note) | Exported: `EXPENSE_COLUMN_COUNT` (`:17`), `EXPENSE_COLUMN_INDEX` (`:33`), `EXPENSE_GVIZ_COLUMNS` (`:36`), `EXPENSE_DATE_COLUMN_LETTER` (`:39`), `expenseValuesRange` (`:46`), `toExpenseCells` (`:66`), `fromExpenseValueRow` (`:76`), `GvizCell` (`:93`), `fromExpenseGvizRow` (`:104`). All nine are imported and used by `spreadsheet.service.ts:11-21`. Note: D1's prose also listed a column-name union type and a name→letter lookup; both exist (`:15`, `:23`) but are module-private. See N1. |
| **AC5** — `addExpense` uses the serializer, order driven by AC1 list | check | `spreadsheet.service.ts:279` `rows: [{ values: toExpenseCells(expense) }]`; `expense-row.ts:67` maps over `EXPENSE_COLUMNS` and looks each writer up by name in `EXPENSE_CELL_WRITERS` (`:54-60`), so the emitted order cannot be stated independently of the list. Covered by `src/services/spreadsheet/spreadsheet.service.spec.ts::addExpense() column E (in-debt flag)` (3 tests, all green). |
| **AC6** — request body unchanged | check | Writers at `expense-row.ts:55-59` are the five expressions from the pre-change `spreadsheet.service.ts:246-253`, moved verbatim (verified against `git show HEAD:src/services/spreadsheet/spreadsheet.service.ts`). Critically, `isInDebt` still emits `{ userEnteredValue: undefined }` — **not** `{ numberValue: 0 }` — when falsy (`:59`). `fields`, `start`, `insertDimension` and the query params are outside the diff hunk and untouched. Covered by `spreadsheet.service.spec.ts::[AC2] writes no value into the column-E cell when isInDebt is false (and does not write 0)` and the `isInDebt is undefined` sibling. |
| **AC7** — range byte-identical `<sheetName>!A1:E<take>` | check | `expense-row.ts:46-50` builds `${sheetName}!${first}1:${last}${take}` from `EXPENSE_COLUMNS[0]` → `A` and the last element → `E`. `spreadsheet.service.ts:295` wraps it in the same `encodeURIComponent`. Covered by `spreadsheet.service.spec.ts:101` — `expect(decodeURIComponent(req.request.url)).toContain(\`${SHEET_NAME}!A1:E${take}\`)`, inside `[AC3] requests range A1:E{take} and maps a populated column-E cell to a truthy isInDebt`. |
| **AC8** — values parser in module, named lookups, field-for-field identical | check | `expense-row.ts:76-90`. Every read is `row[EXPENSE_COLUMN_INDEX.<name>]`; no numeric literal, no positional destructuring. Divergences preserved: `category` and `amount` pass through raw (`:77`, `:79` — casts only, no runtime coercion), `getDateFromSerialNumber(date)` is called **un-guarded** (`:87`), `comment ? String(comment) : undefined` (`:85`), `isInDebt` as `!== undefined && !== null` (`:88`). Covered by `spreadsheet.service.spec.ts::loadLastExpenses() column E read-back` (both tests) and the round-trip suite at `:126-153`. |
| **AC9** — `tq` text/whitespace intact, `select A, B, C, D, E` still emitted | check | `spreadsheet.service.ts:312-315`. The diff replaces only the two fragments; the leading newline, the six-space indentation on both lines and the trailing `.trim()` are byte-identical to `HEAD`. `EXPENSE_GVIZ_COLUMNS` (`expense-row.ts:36`) joins with `', '`, producing exactly `A, B, C, D, E`; `EXPENSE_DATE_COLUMN_LETTER` (`:39`) is `D`, used in both the `where` (`:314`) and the optional `and` clause (`:318`). Covered by `spreadsheet.service.spec.ts:199` — `expect(req.request.params.get('tq')).toContain('select A, B, C, D, E')`, asserted on every test in the `loadExpenses() column E read-back` suite. |
| **AC10** — gviz parser in module, coercions and guards preserved; DTO stays in service | check | `expense-row.ts:104-116`: `String(… ?? '')` (`:110`), `Number(… ?? 0)` (`:112`), the date null/undefined guard before `secureParseDate` (`:113`), the `isInDebt` null/undefined test (`:114`). The JSONP `setResponse` regex unwrap and `ExpensesDTO` remain at `spreadsheet.service.ts:326-336` / `:341-355`; `ExpensesDTO.rows[].c` now references `GvizCell` (`:353`) whose declared shape is unchanged and, per D5, did **not** gain `\| null`. Covered by `spreadsheet.service.spec.ts::loadExpenses() column E read-back` — in particular `a blank column-D (date) cell maps to an undefined date and throws nothing` (`:238-255`), which flushes a literal `null` cell and still passes, confirming the optional-chaining reads survive the move. |
| **AC11** — `setDataSheetFormats` bounds by name, body unchanged | check (with minor) | `spreadsheet.service.ts:151-158` (date → `3`/`4`), `:166-173` (category → `0`/`1`), `:183-190` (amount → `2`/`3`), `:200-207` (isInDebt → `4`/`5`), `:219` (`updateDimensionProperties` → `3`/`4`). Every emitted number resolves to the pre-change literal; I re-derived each from `EXPENSE_COLUMNS`' positions. No dedicated test exists — verified by inspection per the DoD. See finding **F1** on the `isInDebt` upper bound. |
| **AC12** — setup container uses the column count; rest of file untouched | check | `src/modules/setup/setup-page/setup-page.container.ts:103` now passes `EXPENSE_COLUMN_COUNT`. The categories `2` at `:118` is untouched. The diff for this file is exactly two hunks: the import at `:24` and that one argument — no other line changed. The container imports *only* `EXPENSE_COLUMN_COUNT`, satisfying the spec's Risks guard that it must not pull in more. |
| **AC13** — date helpers gone from the service, verbatim in the module, unexported | check | `spreadsheet.service.ts` no longer declares them (diff removes `HEAD:…:350-396` wholesale). `expense-row.ts:128-159` holds all three. I diffed the removed text against the new text: identical, including the `25569.0` constant, the `0.0000000001` nudge, the target-instant offset (`:136`, with its DST comment intact — **not** reverted to `new Date().getTimezoneOffset()`), and `secureParseDate`'s anchored regex (`:144`) character-for-character. All three are module-private. Covered by `spreadsheet.service.spec.ts::round-trips a local date through getSerialNumberFromDate and getDateFromSerialNumber` (`:127`) and `::decodes a winter date correctly even when "now" is in a summer DST offset` (`:161`), both green. |
| **AC14** — tests pass, spec file unmodified, no `.spec.ts` touched | check | `git diff --stat -- '*.spec.ts'` → empty. `git ls-files --others --exclude-standard` → no `.spec.ts`. `git status --porcelain` lists only `src/modules/setup/setup-page/setup-page.container.ts`, `src/services/spreadsheet/spreadsheet.service.ts`, and the three untracked docs/new-module files. Harness test layer: **49 passed, 2 skipped (51)**, 11 files passed / 1 skipped. The one skipped file is the pre-existing `describe.skip('AppComponent')` at `src/app/app.component.spec.ts:7` — untouched by this change, so no new skip and no un-skip. |
| **AC15** — manual smoke run | **N/A to me** — human-only. Section 4 of the DoD. I cannot click through the running app; the spec correctly routes this to the owner. The two conversions with no automated coverage (`setDataSheetFormats`, the setup container's column count) both ride on this check, so it is not a formality. |
| **AC16** — lint + tsc clean, no new `eslint-disable`, no `any` in the new module | check | `npm run lint` → `All files pass linting.` `npx tsc -b tsconfig.app.json tsconfig.spec.json` → exit 0, no output. Grep of `expense-row.ts` shows no `eslint-disable` and no `any`; the parsers take `ReadonlyArray<unknown>` / `ReadonlyArray<GvizCell>` and narrow, as the spec's Risks section required. The lookups are `Record<ExpenseColumn, …>` keyed by a string-literal union, so `EXPENSE_COLUMN_INDEX.date` compiles under `noPropertyAccessFromIndexSignature`. |
| **AC17** — no residual `A1:E` / `A, B, C, D, E` / 5-element positional row outside the module | check | `grep -rn "A1:E" src/` → `expense-row.ts:43` (doc comment), `spreadsheet.service.spec.ts:94,101`, `shared/helpers/index.spec.ts:119,122` (an unrelated error-message fixture). `grep -rn "A, B, C, D, E" src/` → `expense-row.ts:35` (doc comment), `spreadsheet.service.spec.ts:199`. All remaining hits are comments in the module itself or unmodified `.spec.ts` files, exactly as the AC permits. No positional five-element expense array survives — the destructure at `HEAD:…:279` and the `row.c[0..4]` reads at `HEAD:…:322-332` are both gone. |
| **AC18** — untouched paths, no new dependency | check | `git status --porcelain` shows nothing under `src/@state/`, `src/shared/`, `src/services/index.ts`, `angular.json`, `package.json`, `package-lock.json`, `ngsw-config.json` or `knowledge/`. The only other modified file is `docs/backend-less-assessment.md`, which predates this task per the brief. `policy/sprint-window.json`'s two denied paths (`angular.json`, `package.json`) are not approached. |

## Harness

`bash scripts/harness.sh` — **green**, all four layers ran:

```
=== harness summary ===
  lint:      passed
  typecheck: passed
  build:     passed
  test:      passed
harness: green
```

Test layer detail: `Test Files 11 passed | 1 skipped (12)`, `Tests 49 passed | 2 skipped (51)`.

Run separately and also clean:

- `npm run lint` → `All files pass linting.`
- `npx tsc -b tsconfig.app.json tsconfig.spec.json` → exit 0, silent.

## Findings

### F1 — `endColumnIndex` for the in-debt validation uses the column *count*, not that column's index + 1

- **Severity:** minor
- **Location:** `src/services/spreadsheet/spreadsheet.service.ts:206`
- **What's wrong:** three of the four `RepeatCellRequest` ranges express their upper bound as
  `EXPENSE_COLUMN_INDEX.<name> + 1` (`:155`, `:170`, `:187`), and so does
  `updateDimensionProperties` (`:219`). The fourth uses `endColumnIndex: EXPENSE_COLUMN_COUNT`.
  Today both evaluate to `5`, so the request body is unchanged and AC11 is met.
- **Why it matters:** the two expressions coincide only while `isInDebt` is the last column. The
  entire premise of this refactor is that inserting a column becomes a one-line edit to
  `EXPENSE_COLUMNS`. Appending a column after `isInDebt` would silently widen the in-debt
  `NUMBER_GREATER_THAN_EQ` validation and its currency format across two columns — the exact class
  of silent mismatch the spec's §7 rationale says nothing would catch. It is not a bug now; it is a
  latent one, and it is invisible because `setDataSheetFormats` has no test.
- **Suggested direction:** make the four ranges use one consistent idiom for "this column only", so
  the upper bound is always derived from the same column name as the lower bound. Consider whether
  the module should own a small "range for column N" helper rather than the service repeating
  `index` / `index + 1` five times.

### F2 — `fromExpenseValueRow` is passed directly as an `Array.prototype.map` callback

- **Severity:** minor
- **Location:** `src/services/spreadsheet/spreadsheet.service.ts:302`
- **What's wrong:** `result.values?.map<Expense>(fromExpenseValueRow)`. `map` invokes the callback
  with `(value, index, array)`. The parser's arity is 1, so the extra arguments are discarded and
  behaviour is correct today.
- **Why it matters:** it is a point-free binding that quietly couples the parser's signature to a
  caller it does not know about. If a second parameter is ever added to `fromExpenseValueRow` — a
  row index, an options bag, a schema version during the future schema-marker work — every row will
  receive its array index in that slot with no compile error and no test failure. Given the file's
  subject matter (row/column addressing), that is a bad place to leave an implicit contract.
- **Why I did not raise this to major:** it is correct as written and the parser has no plausible
  second parameter inside this spec's scope. This is a durability note, not a defect.
- **Suggested direction:** consider passing an explicit single-argument arrow at the call site, the
  way the gviz path already does at `:336` (`(row) => fromExpenseGvizRow(row.c)`), so the two read
  paths read alike and the parser's arity stops being load-bearing.

### N1 — D1's stated public surface is narrower in practice than the decision described

- **Severity:** nit
- **Location:** `src/services/spreadsheet/expense-row.ts:15`, `:23-26`
- **What's wrong:** D1 lists "a column-name union type" and "a derived name→letter lookup" as part
  of the module's public surface. `ExpenseColumn` and `EXPENSE_COLUMN_LETTERS` exist but are
  module-private; only the two derived fragments callers actually need
  (`EXPENSE_GVIZ_COLUMNS`, `EXPENSE_DATE_COLUMN_LETTER`) are exported.
- **Why it matters:** it is a deliberate-looking deviation from a written decision, and AC4 says
  "the surface listed in D1" before enumerating a shorter list. A reader reconciling spec against
  code will stop here.
- **Why it is only a nit:** AC4's own enumeration is satisfied exactly, and keeping unexported what
  has no caller is the same reasoning D3 applies to the date helpers. I consider the code right and
  the spec prose slightly ahead of it.
- **Suggested direction:** nothing to change in code. Worth one line in the spec (or the follow-up
  `centralise-category-row-mapping` spec) recording that the letter lookup stayed private.

### N2 — Redundant intermediate constant for the index lookup

- **Severity:** nit
- **Location:** `src/services/spreadsheet/expense-row.ts:28-33`
- **What's wrong:** `EXPENSE_COLUMN_INDEXES` is built and then immediately re-bound to the exported
  `EXPENSE_COLUMN_INDEX` with a `Readonly<…>` annotation. Two names for one value.
- **Why it matters:** only readability — a reader has to check whether the singular and plural
  names differ in meaning. They do not.
- **Suggested direction:** consider whether the `Readonly` annotation can be applied at the single
  declaration site, dropping the second name.

### N3 — Bare `65` for the `'A'` code point

- **Severity:** nit
- **Location:** `src/services/spreadsheet/expense-row.ts:24`
- **What's wrong:** `String.fromCharCode(65 + index)`.
- **Why it matters:** it does not violate AC2 (it is a derivation, not a second ordering), and the
  comment at `:19-22` correctly documents the past-Z limitation the spec's Risks section asked for.
  `65` is simply less self-evident than the alternative in a file whose whole job is column letters.
- **Suggested direction:** consider expressing the base as the character itself rather than its code
  point.

### Not filed — pre-existing, per `knowledge/constraints/known-issues.md`

- The two read paths' divergent coercions and the un-guarded `getDateFromSerialNumber` are
  **preserved deliberately** (D4, and AC8/AC10 require it). They are now more visible, sitting 30
  lines apart in one file, which is an improvement, not a regression. Not a finding.
- Positional row addressing for deletion is untouched. `deleteSheetRow`'s `deleteDimension` and
  `app.effects.ts:204-223`'s index search are outside the diff entirely — I confirmed `src/@state/`
  has no working-tree changes. The spec's headline risk (row-index arithmetic) was respected.
- `knowledge/domain/spreadsheet-layout.md:89-91` now makes a false claim ("Column order is
  hard-coded in `addExpense`, `loadLastExpenses` … and the gviz `select`"). This is **expected** —
  D10 defers it and `knowledge/` is outside the sprint write window. Flagging it here so the owner's
  write-window decision does not get lost, not as a defect in this change.

## What I checked

- Read `docs/specs/centralise-row-mapping.md` and `docs/dod/centralise-row-mapping.md` in full.
- `git status --porcelain`, `git diff --stat`, `git ls-files --others --exclude-standard` — to fix
  the exact change set and confirm nothing outside it moved.
- `git diff -- src/` in full, read hunk by hunk.
- `git diff --stat -- '*.spec.ts'` (empty) and an untracked-file scan for `.spec.ts` (none).
- `git show HEAD:src/services/spreadsheet/spreadsheet.service.ts` — to compare the removed date
  helpers, the removed `addExpense` cell array, the removed parsers and the original `tq` literal
  against their new homes, rather than trusting the diff's framing.
- Read `src/services/spreadsheet/expense-row.ts` in full.
- Read `src/services/spreadsheet/spreadsheet.service.spec.ts:93-132` and `:196-255`, plus the full
  `describe`/`it` listing, to name the test covering each AC and to confirm which assertions
  actually pin the wire format.
- Read `src/modules/setup/setup-page/setup-page.container.ts:96-125` and both `createSheet` call
  sites.
- Read `src/shared/models/expense.ts` and `src/services/index.ts`.
- `grep -rn "A1:E" src/`, `grep -rn "A, B, C, D, E" src/`,
  `grep -rn "describe.skip\|it.skip\|xdescribe\|xit(" src/ --include=*.spec.ts`.
- `cat policy/sprint-window.json` — confirmed neither denied path is touched.
- `sed -n '85,100p' knowledge/domain/spreadsheet-layout.md` — confirmed the D10 staleness.
- Ran `bash scripts/harness.sh` (green, all four layers), `npm run lint` (clean),
  `npx tsc -b tsconfig.app.json tsconfig.spec.json` (exit 0).

I modified nothing. This review file is my only write.

## Out of scope

Noticed, deliberately not filed against this change:

- `docs/backend-less-assessment.md` shows as modified with 18 deletions. Per the task brief this
  predates the change; I did not review it and it is unrelated to the refactor.
- The categories sheet carries the identical duplication (`updateCategories`, `addCategory`,
  `getAllCategories`, `setCategoriesSheetFormats`, and the `A1:B{n}` / `A:B` ranges). Correctly
  excluded; the spec already names the follow-up as `centralise-category-row-mapping`.
- `src/app/app.component.spec.ts:7` is a pre-existing `describe.skip`. Not introduced here and not
  this change's problem, but it means `AppComponent` has no regression net at all.
- Every effect still ends `catchError -> log -> EMPTY`. This change adds no new failure path — the
  only new throw site is `secureParseDate`, which moved verbatim and is reached from exactly the
  same place as before — so the swallowed-error posture is unchanged, not worsened.
- Whether `docs/**` writes sit inside `policy/sprint-window.json`'s `allowed_write_paths` (`src/`
  only) is a process question about spec/DoD/review artifacts generally, not about this code change.
  Raising it for the owner rather than against this diff.
