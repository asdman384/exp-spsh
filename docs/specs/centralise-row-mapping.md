# Centralise expense row mapping

## Goal

Move the `data_<name>` sheet's column order, row serialization and row parsing into a single
module (`src/services/spreadsheet/expense-row.ts`) so the three places that encode column order
independently today — `addExpense`, the `A1:E{n}` range, and the gviz `select A, B, C, D, E` —
all read it from one file; requested by the repo owner from ranked recommendation 4 of
`docs/backend-less-assessment.md:224` (§7, `docs/backend-less-assessment.md:173-178`), as the
prerequisite for any later schema change.

## Scope

**In:**

- New module `src/services/spreadsheet/expense-row.ts`: the ordered column list for the expense
  sheet, derived letters / indices / column count, one `Expense` → cell-array serializer, and the
  two row parsers (serial-number `values.get` rows, gviz `Date(...)` rows).
- `src/services/spreadsheet/spreadsheet.service.ts` — three consumers rewired to that module:
  `addExpense` (`:241-255`), `loadLastExpenses`'s range and mapper (`:270-287`), `loadExpenses`'s
  `tq` and mapper (`:298-333`).
- Same file, two further consumers of the same knowledge: `setDataSheetFormats`'s per-column
  validation ranges (`:138-186`, column indices `0`, `2`, `3`, `4`) and the private date helpers
  `getSerialNumberFromDate` / `getDateFromSerialNumber` / `secureParseDate` (`:350-396`), which
  move into the new module verbatim.
- `src/modules/setup/setup-page/setup-page.container.ts:102` — the literal `5` passed to
  `createSheet` becomes the module's column count. One literal, no I/O change.
- **Behaviour-preserving refactor only.** Every HTTP request keeps its current URL, params, body
  and range strings byte-for-byte; every parsed `Expense` keeps its current field values,
  including today's quirks.

**Out (each needs its own spec if wanted):**

- **The id column and id-based delete** (assessment §1 / recommendation 1). No new column is
  added here, and nothing about positional addressing changes.
- **One read path + local cache** (§2 / recommendation 5). Both read paths stay; both date
  encodings stay.
- **`moveDimension` for category reorder** (§6 / recommendation 6).
- **Schema version marker + migration step in setup** (§7's second half / recommendation 7).
  Nothing is written to or read from the spreadsheet to identify a schema version.
- **Write outbox draining on `online$`** (§5 / recommendation 8).
- **`drive.file` + Picker scope narrowing** (§4 / recommendation 9).
- **New tests** (recommendation 10). The testing phase is skipped for this run: no `.spec.ts`
  file is created and none is edited. The existing `src/services/spreadsheet/spreadsheet.service.spec.ts`
  is the regression net and must stay green *unmodified* — see [AC14].
- **The `categories` sheet mapping** (`updateCategories`, `addCategory`, `getAllCategories`,
  `setCategoriesSheetFormats`, and the `A1:B{n}` / `A:B` ranges). It is the same *shape* of
  duplication but a different sheet with a different encoding, and folding it in doubles the
  blast radius of a refactor whose whole value is being uneventful. Left out deliberately;
  see D8 for the naming that keeps a sibling `category-row.ts` obvious. **Follow-up spec
  needed: `centralise-category-row-mapping`.**
- **Any change to `src/@state/`.** `app.effects.ts` was checked and holds no column-order
  knowledge — see Approach.
- **Fixing the parse divergences that this refactor makes visible** (D4). They are preserved,
  not corrected.
- **Updating `knowledge/domain/spreadsheet-layout.md:89-96`**, which states the column order is
  hard-coded in three places. That claim stops being true; `knowledge/` is outside the
  `policy/sprint-window.json` write window (`src/` only). See D10.

## Approach

- **The work lands in one new pure module plus one service; no state layer, no new component
  logic, no remote I/O moves.** `src/services/spreadsheet/expense-row.ts` is a plain module —
  no `@Injectable`, no `inject()`, no `HttpClient`, no RxJS — following the "pure module next to
  its consumer" precedent of `src/@state/report-failure.ts`. All HTTP stays in
  `SpreadsheetService`; all effect wiring stays in `src/@state/app.effects.ts`, untouched.
- **`src/@state/app.effects.ts` carries none of this knowledge and is not modified.** Verified:
  its only sheet-shaped literal is the `100` row window in `deleteExpense$`
  (`app.effects.ts:216`), which is a row count, not a column. `src/shared/helpers/index.ts`'s
  `isExpenseEqual` compares `Expense` fields, never columns. The date converters exist in exactly
  one place today (`spreadsheet.service.ts:350-396`) and simply move.
- **One ordered list is the source of truth.** The module declares the column order once as a
  readonly list of `keyof Expense` values (`category`, `comment`, `amount`, `date`, `isInDebt`),
  typed so that renaming a field in `src/shared/models/expense.ts:1-7` breaks the build. Column
  letters, 0-based indices and the column count are *derived* from that list, never written out
  again. Authoritative schema reference: `knowledge/domain/spreadsheet-layout.md:34-44`.
- **Serialization is driven by the list, not parallel to it.** The `Expense` → cells function maps
  over the ordered list and looks each column's writer up in a record keyed by column name, so the
  emitted array cannot drift out of order; the writers themselves are the five current expressions
  from `spreadsheet.service.ts:246-253` moved across unchanged. Parsers read by *name* through the
  derived index map (`row[index.comment]` rather than `row[1]`), so no numeric literal survives.
- **Range and query fragments are composed, not re-typed.** `loadLastExpenses` builds its range
  from the module's first/last column letters; `loadExpenses` interpolates a module-supplied
  column-list fragment and date-column letter into its existing `tq` template, leaving the
  template's literal text and whitespace exactly as it is today (D6).
- **Files:**

| File | Action |
|---|---|
| `src/services/spreadsheet/expense-row.ts` | **create** |
| `src/services/spreadsheet/spreadsheet.service.ts` | modify — 5 call sites rewired, 3 private functions removed (moved) |
| `src/modules/setup/setup-page/setup-page.container.ts` | modify — one numeric literal replaced |
| `src/services/index.ts` | **not** modified — see D2 |
| `src/@state/*`, `src/shared/helpers/index.ts`, `src/shared/models/expense.ts` | **not** modified |
| `src/services/spreadsheet/spreadsheet.service.spec.ts` | **not** modified — it is the regression net |

## Decisions

### D1 — What the module exports

| | |
|---|---|
| **Alternatives** | (a) a bag of loose constants (`COLUMN_LETTERS`, `RANGE_SUFFIX`, `SELECT_CLAUSE`) plus free mapper functions; (b) an injectable `ExpenseRowMapper` service; (c) one ordered column list plus derived lookups plus three mapper functions. |
| **Choice** | **(c)**. Public surface: the ordered column list, a column-name union type, a derived name→letter lookup, a derived name→0-based-index lookup, the column count, the gviz column-list fragment, a range builder for the `values.get` path, `toExpenseCells(expense)`, `fromExpenseValueRow(row)`, `fromExpenseGvizRow(cells)`, and the `GvizCell` row-cell type. |
| **Reason** | (a) reproduces the problem one layer down — three constants can still disagree. (b) buys nothing: there is no dependency to inject, and DI would make the module untestable-by-inspection and unusable from a plain constant position. (c) has exactly one authored fact (the ordered list); everything else is derived, so a future column insert is a one-line edit in one file, which is the entire point of recommendation 4. |

### D2 — Where the module lives and whether it is barrelled

| | |
|---|---|
| **Alternatives** | (a) `src/shared/helpers/index.ts` alongside `isExpenseEqual`; (b) `src/shared/models/`; (c) `src/services/spreadsheet/expense-row.ts`, not re-exported from `src/services/index.ts`. |
| **Choice** | **(c)**. |
| **Reason** | It is transport-shaped knowledge (Sheets cell encodings, gviz cell shapes, `gapi.client.sheets.CellData`), so it belongs beside its only consumer, not in `shared/`, which is model/UI territory. `src/services/index.ts:1-4` re-exports only injectables; adding a constants module there would widen the public surface of the services barrel for no caller. `SpreadsheetService` imports it by relative path; `setup-page.container.ts` imports it by the `src/services/spreadsheet/expense-row` path, matching the repo's existing `src/`-rooted absolute-import style. |

### D3 — The date converters move, and stay module-private

| | |
|---|---|
| **Alternatives** | (a) leave them in `spreadsheet.service.ts` and have the mapper import them; (b) move them into the mapper and export them; (c) move them into the mapper, unexported. |
| **Choice** | **(c)**. |
| **Reason** | Parsing and serializing a row *is* the date conversion — splitting them leaves the service still owning half the encoding, which is the duplication being removed, and (a) also creates a service↔mapper import cycle risk. Exporting them (b) would widen the surface with no caller; the round trip is already exercised through the service's public methods by `spreadsheet.service.spec.ts:126-194`. **Their bodies move verbatim** — in particular `getDateFromSerialNumber`'s target-instant timezone offset (`spreadsheet.service.ts:354-360`), which is a shipped DST bug fix with a regression test at `spreadsheet.service.spec.ts:156-194`. Do not "tidy" it back to `new Date().getTimezoneOffset()`. |

### D4 — Two parsers, not one — the divergences are preserved

| | |
|---|---|
| **Alternatives** | (a) one `fromRow` with a pluggable date decoder; (b) two named parsers preserving each path's current field-by-field semantics. |
| **Choice** | **(b)**, and unifying them is explicitly forbidden in this spec. |
| **Reason** | The two paths do genuinely different things today and a merge would silently change behaviour a user can observe. `values.get` (`spreadsheet.service.ts:279-285`) passes `category` and `amount` through raw and calls `getDateFromSerialNumber(date)` with **no null guard** (a short row yields an Invalid Date); gviz (`:322-332`) coerces `String(… ?? '')` / `Number(… ?? 0)` and *does* guard the date before `secureParseDate`. Both derive `isInDebt` as "cell is neither `undefined` nor `null`". Harmonising them is a behaviour change that belongs with the single-read-path work (assessment §2), which this spec scopes out. Two functions, same module, same column indices — that is already the whole win. |

### D5 — Ownership of the gviz response types

| | |
|---|---|
| **Alternatives** | (a) move the whole `ExpensesDTO` (`spreadsheet.service.ts:362-375`) into the mapper; (b) leave `ExpensesDTO` in the service and let the mapper own only the cell type. |
| **Choice** | **(b)** — the mapper exports the single-cell type (shape unchanged: `{ v: string \| number; f?: string }`) and `ExpensesDTO` in the service references it for its `rows[].c` array. |
| **Reason** | The JSONP envelope, the `setResponse(...)` regex unwrap and the `table.cols` metadata are transport concerns of the gviz endpoint (`knowledge/interfaces/gviz-query.md`), not row mapping; the mapper's job starts at "here is one row's cells". Keeping the cell type declared once still removes the duplication that matters. The declared shape must not gain `\| null` even though gviz sends `null` for blank cells and `spreadsheet.service.spec.ts:249-251` flushes one — the optional-chaining reads handle it today and widening the type would ripple into unrelated narrowing. |

### D6 — Compose the gviz `tq`, do not regenerate it

| | |
|---|---|
| **Alternatives** | (a) a `buildExpenseQuery(filter)` in the mapper that returns the whole `tq` string; (b) keep the template literal in the service and interpolate two module-supplied fragments — the column list and the date column's letter. |
| **Choice** | **(b)**. |
| **Reason** | (a) drags date formatting and filter semantics into a module that should only know columns, and it is the change most likely to alter the bytes on the wire: the current template (`spreadsheet.service.ts:298-305`) is a multi-line literal whose `.trim()` leaves an embedded newline and six spaces of indentation inside the query. Google tolerates that whitespace today, and a regenerated single-line query would be a silent change to a request this spec promised not to touch. (b) leaves the literal text intact and still deletes the hard-coded `A, B, C, D, E` and the hard-coded `D`. |

### D7 — `setDataSheetFormats` and the setup container are included

| | |
|---|---|
| **Alternatives** | (a) restrict the change to the three sites named in §7; (b) also rewire `setDataSheetFormats`'s four column indices and the setup container's literal `5`. |
| **Choice** | **(b)**. |
| **Reason** | They are the same fact written in more places: inserting a column would move the date validation, the currency validation, the in-debt validation and the 120px width onto the wrong columns, and would leave new sheets one column short — exactly the mismatch §7 says nothing would catch. They are also the cheapest sites to convert (numeric literals → named lookups, no logic). The setup container change is a constant substitution only: it adds no I/O to a component, and the call it feeds (`setup-page.container.ts:102`, `:177`) already existed. |

### D8 — Naming

`expense-row.ts` with `Expense`-prefixed exports, rather than `row-mapper.ts` / `sheet-schema.ts`.
The module is the schema of *one* sheet; the categories sheet has its own, deliberately out of
scope. The name makes the future sibling obvious (`category-row.ts`) instead of inviting a second
sheet's rules into a file called "the row mapper". File name matches the repo's kebab-case
convention; no `.service` suffix because it is not one.

### D9 — No dependency, no config change

Nothing new is installed and neither `package.json` nor `angular.json` is touched, so the
`policy/sprint-window.json:8-11` denials are not approached. All writes land under `src/`. The
module uses the `gapi.client.sheets` *types* only (already referenced at
`spreadsheet.service.ts:1-2`); if the new file needs those types it carries the same
`/// <reference types="gapi.client.sheets-v4" />` directives rather than adding a dependency.

### D10 — Knowledge-base update is deferred

`knowledge/domain/spreadsheet-layout.md:89-96` ("Column order is hard-coded in `addExpense`,
`loadLastExpenses` … and the gviz `select`") becomes stale the moment this lands, and
`knowledge/references/source-map.md` gains a file. `knowledge/` is outside this sprint's write
window. **Decision needed from owner:** whether to widen the window for a docs-only follow-up or
to batch the knowledge refresh with the next in-window change. Do not edit `knowledge/` as part of
this task.

## Risks

- **This change is entirely about the sheet column layout, so the blast radius is every user's
  existing data.** It touches column letters, column indices, the `A1:E{n}` range and both date
  conversions — the three categories this repo treats as highest-risk. The mitigation is that the
  change is *purely* a relocation: if any request body, range string, `tq` string or parsed field
  differs from today's, the refactor is wrong, not the old code. Verify against the wire, not
  against intent.
- **Row-index arithmetic is not touched and must not be.** `deleteSheetRow`'s positional
  `deleteDimension` (`spreadsheet.service.ts:67-77`) and `deleteExpense$`'s index search
  (`app.effects.ts:204-223`) stay exactly as they are. Do not let "centralise the indices" bleed
  into row indices — the module is about *columns*.
- **Date conversion is the single most fragile thing being moved.** Three functions move across a
  file boundary; a transcription slip in the `25569.0` offset, the `1e-10` nudge, the
  target-instant offset, or `secureParseDate`'s anchored regex silently corrupts either what is
  written or what is displayed. `spreadsheet.service.spec.ts:126-194` catches the round trip and
  the DST case; it catches nothing about the regex's rejection path, so move that function by
  copy, not by retyping.
- **Tempting-but-forbidden fixes.** Unifying the two parsers (D4), null-guarding the serial-number
  date, coercing `amount` in the values path, widening the gviz cell type to include `null` — each
  looks like an improvement and each is a behaviour change outside this spec. They belong to the
  single-read-path spec.
- **`tq` whitespace.** `spreadsheet.service.spec.ts:199` asserts only
  `toContain('select A, B, C, D, E')`, so a fragment joined with the wrong separator
  (`A,B,C,D,E`) fails loudly, but a change to the surrounding indentation would pass the test and
  still alter the request. Keep the template literal's shape.
- **Typing friction under this repo's strict flags.** `gapi.client.sheets.ValueRange.values` is
  `any[][]`; the mapper must take `ReadonlyArray<unknown>` (or similar) and narrow, because
  `@typescript-eslint/no-explicit-any` is an error here and this file has no legitimate-`any`
  precedent. `noPropertyAccessFromIndexSignature` means the derived letter/index lookups must be
  records keyed by a string-literal union (or `as const` objects), not `Record<string, …>`, or
  `letters.date` will not compile.
- **Derived column letters only work to column Z.** Deriving a letter as `A + index` is correct for
  the 5 columns that exist and for any realistic growth, but breaks silently past 26 columns. An
  acceptable limit to accept today; worth a comment in the module rather than an AA-column
  algorithm nobody needs.
- **Two files import the module; one is a container.** If `setup-page.container.ts` ends up
  importing anything beyond the column count, that is a sign the module is growing responsibilities
  it should not have — remote I/O and request-building stay in `SpreadsheetService`.
- **No test coverage exists for `setDataSheetFormats` or the setup container.** Those two
  conversions are verified by inspection and by a manual setup run only ([AC15]).

## Acceptance criteria

**The module**

- `[AC1]` `src/services/spreadsheet/expense-row.ts` exists and declares the expense sheet's column
  order exactly once, as an ordered readonly list of `Expense` field names in the order
  `category`, `comment`, `amount`, `date`, `isInDebt`, typed against `keyof Expense` so that
  renaming a field in `src/shared/models/expense.ts` fails `npx tsc -b tsconfig.app.json tsconfig.spec.json`.
- `[AC2]` Column letters, 0-based column indices and the column count in that module are all
  *derived* from the list in [AC1]; no second hand-written ordering (no `['A','B','C','D','E']`
  array, no `5` literal) exists in the file.
- `[AC3]` The module contains no Angular decorator, no `inject()`, no `HttpClient`, no `Store` and
  no RxJS import, and is not re-exported from `src/services/index.ts`.
- `[AC4]` The module exports, and `SpreadsheetService` uses, the surface listed in D1: a cells
  serializer, a `values.get` row parser, a gviz row parser, a range builder, a gviz column-list
  fragment, a date-column letter, a column-index lookup and a column count.

**`addExpense` (write path)**

- `[AC5]` `addExpense` obtains `updateCells.rows[0].values` by calling the module's serializer;
  the emitted array is produced by iterating the [AC1] list, so its order cannot be stated
  independently of it.
- `[AC6]` The request body is unchanged: 5 cell entries; `stringValue` for category and comment,
  `numberValue` for amount, `numberValue` serial number for date, and for the 5th entry
  `{ numberValue: expense.amount }` when `isInDebt` is truthy and an **absent**
  `userEnteredValue` (not `{ numberValue: 0 }`) otherwise. `insertDimension`, `fields`, `start`
  and the query params are untouched.

**`loadLastExpenses` (values read path)**

- `[AC7]` The range is built from the module's first and last column letters and still resolves to
  the byte-identical string `<sheetName>!A1:E<take>` before `encodeURIComponent`.
- `[AC8]` Its row parser lives in the module, reads each field via the named column-index lookup
  (no numeric literal, no positional destructuring of the row), and produces field-for-field what
  `spreadsheet.service.ts:279-285` produces today — including the un-guarded
  `getDateFromSerialNumber` call and the raw pass-through of `category` and `amount` (D4).

**`loadExpenses` (gviz read path)**

- `[AC9]` The `tq` template literal keeps its current text and whitespace; only the column list and
  the `where` clause's date column letter are interpolated from the module. The final query still
  contains the exact substring `select A, B, C, D, E`.
- `[AC10]` Its row parser lives in the module, reads cells via the named column-index lookup, and
  produces field-for-field what `spreadsheet.service.ts:322-332` produces today — including
  `String(… ?? '')`, `Number(… ?? 0)`, the date null-guard and the `isInDebt` null/undefined test.
  The JSONP unwrap regex and `ExpensesDTO` stay in the service (D5).

**Remaining column-order consumers**

- `[AC11]` `setDataSheetFormats`'s four `RepeatCellRequest` ranges and its
  `updateDimensionProperties` range derive `startColumnIndex` / `endColumnIndex` /
  `startIndex` / `endIndex` from the module's column-index lookup by column *name*; the literals
  `0`/`1`, `2`/`3`, `3`/`4`, `4`/`5` no longer appear as column bounds. The emitted request body is
  unchanged.
- `[AC12]` `src/modules/setup/setup-page/setup-page.container.ts:102` passes the module's column
  count instead of the literal `5`; the `2` for the categories sheet (`:117`) is untouched, and no
  other line of that file changes.
- `[AC13]` `getSerialNumberFromDate`, `getDateFromSerialNumber` and `secureParseDate` no longer
  exist in `spreadsheet.service.ts`; their bodies exist in the new module unchanged, unexported —
  including `getDateFromSerialNumber`'s offset derived from the target instant.

**Whole-repo gates**

- `[AC14]` `npm test` passes with `src/services/spreadsheet/spreadsheet.service.spec.ts`
  **unmodified** — in particular its `A1:E{take}` range assertion (`:101`), its
  `values[3]`/`values[4]` cell assertions, its `select A, B, C, D, E` assertion (`:199`), the
  serial round trip (`:126-153`) and the DST regression (`:156-193`). No `.spec.ts` file anywhere
  is added, edited or deleted by this task.
- `[AC15]` Manual smoke run (`npm run watch` + `npm run serve`, `http://localhost:4200/exp-spsh/`):
  adding an expense writes a row whose category, comment, amount, date/time and in-debt cell land
  in columns A–E as before; the dashboard list and a month's statistics load with the same values
  as before the change; deleting an expense still removes the right row.
- `[AC16]` `npm run lint` and `npx tsc -b tsconfig.app.json tsconfig.spec.json` are clean, with no
  new `eslint-disable` and no `any` in the new module.
- `[AC17]` A repo-wide search shows that outside `src/services/spreadsheet/expense-row.ts` (and
  `.spec.ts` files, which are unmodified) there is no remaining occurrence of `A1:E`,
  `A, B, C, D, E`, or a five-element positional expense row/cell array — i.e. inserting a new
  expense column later is a single-file edit plus its consumers compiling.
- `[AC18]` `src/@state/**`, `src/shared/**`, `src/services/index.ts`, `angular.json`,
  `package.json`, `ngsw-config.json` and `knowledge/**` are unchanged; no dependency is added.
