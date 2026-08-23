> **Artifact version note:** this copy was taken before the follow-up decision
> on `undefined` versus `false` was added. It is intentionally stale.

# Spec: "In Debt" expense flag (spreadsheet column E)

## Status

`Draft`

## Work item and ownership

- **Parent:** —
- **Owner:** Oleh Piankov
- **Artifact version:** written against `playground-page` branch, commit `89bf778`

---

## Goal

Let a user mark an expense as "in debt" when adding it. A checked expense is still written as a normal expense (columns A–D, unchanged), and in addition the same amount is written into a new column E on that row. The app also reads column E back so the debt flag survives a reload and can be shown in the expenses table, and the delete flow keeps matching the correct row once two otherwise-identical expenses can differ only by this flag.

---

## Assumptions

- **No expense-edit flow exists today (only add/delete).** If wrong: the "in debt" flag would also need an edit path; out of scope either way per this spec.
- **Existing data sheets have no header row** (`addSheet`/`createSheet` create sheets with only `gridProperties.rowCount/columnCount`, no header labels written anywhere) — so there is no header cell to add for column E. If wrong: a header-row update would need to be added to sheet creation/migration.
- **Historical rows in existing sheets will simply have an empty column E** (blank, not backfilled) and this is acceptable. If wrong: a backfill/migration step is needed before rollout.
- **`append()` in `spreadsheet.service.ts` is dead code** (marked `@deprecated`, not called from any effect). If wrong: it also needs the column-E treatment to avoid writing malformed rows.
- **Google Sheets `gviz` query used by `loadExpenses` can select a 5th column (`E`) without altering the existing `where`/date-filter clause on `D`.** If wrong: the query needs restructuring, not just an added column.

---

## Modules and interfaces affected

| Module | Interface change | How the interface is tested |
|--------|-----------------|-----------------------------|
| `src/shared/models/expense.ts` | Extended: add `isInDebt?: boolean` to `Expense` | Type-checked by consumers; no dedicated test (interface is a plain type) |
| `src/services/spreadsheet/spreadsheet.service.ts` — `addExpense()` | Extended: writes a 5th cell (column E) — `expense.amount` when `isInDebt` is true, otherwise no value | Extend `spreadsheet.service.spec.ts` beyond the current smoke test with a case asserting the 5th cell's `userEnteredValue` for both `isInDebt: true` and `isInDebt: false`/`undefined` |
| `src/services/spreadsheet/spreadsheet.service.ts` — `loadLastExpenses()` | Extended: range widens from `A1:D{take}` to `A1:E{take}`; destructures a 5th value into `isInDebt` (`true` iff the cell has a value) | New spec case with a mocked HTTP response including/excluding the 5th column |
| `src/services/spreadsheet/spreadsheet.service.ts` — `loadExpenses()` | Extended: gviz `select` clause widens from `A, B, C, D` to `A, B, C, D, E`; maps `row.c[4]` into `isInDebt` | New spec case with a mocked gviz JSONP response including/excluding `c[4]` |
| `src/services/spreadsheet/spreadsheet.service.ts` — `setDataSheetFormats()` | Extended: adds a `currencyCellValidation`-equivalent rule for column index 4 (same `NUMBER_GREATER_THAN_EQ 0` rule as column 2/amount) so column E behaves like a currency cell | Not currently tested (existing method has no test coverage); no new test added, matches existing precedent |
| `src/modules/setup/setup-page/setup-page.container.ts` — `createDataSheet()` | Extended: `columnCount` literal passed to `createSheet(...)` changes from `4` to `5` so newly-created sheets have room for column E | No existing test file for this container; not adding one (out of scope, matches existing precedent) |
| `src/shared/helpers/index.ts` — `isExpenseEqual()` | Extended: adds `e1.isInDebt === e2.isInDebt` (with `undefined`/`false` treated as equal — see Decisions) to the equality check used by `deleteExpense$` to locate the row to delete | Extend `index.spec.ts` with cases covering both debt-flag values and the `undefined` vs `false` equivalence |
| `src/@state/app.effects.ts` — `addExpense$` / `deleteExpense$` | None — both effects pass the `Expense` object through unchanged; behavior changes only because the object now carries `isInDebt` | No new test (no existing effects tests to extend, matches existing precedent) |
| `src/modules/dashboard/dashboard/dashboard-page.container.html` / `.ts` | Extended: form gets a new `mat-checkbox` bound to `expense.isInDebt`; `form.resetForm({...})` reset object gains `isInDebt: false` | No existing spec file for this container; not adding one (out of scope, matches existing precedent) |
| `src/shared/components/expenses-table/expenses-table.component.ts` / `.html` | Extended: `DEFAULT_COLS` gains `'isInDebt'`; new `matColumnDef="isInDebt"` rendering a checkmark/label; column auto-hides via existing `hasData()` logic when no row in view has the field set | Extend `expenses-table.component.spec.ts` only if new assertions are added beyond the existing smoke test — not required by this spec |

---

## Approach

### High-level stages

| Stage | Outcome | Boundary | Required evidence | Depends on |
|-------|---------|----------|-------------------|------------|
| 1 | `Expense.isInDebt` added to the model | Does not touch UI or service code | Type compiles; no runtime behavior yet | — |
| 2 | `spreadsheet.service.ts` reads and writes column E (`addExpense`, `loadLastExpenses`, `loadExpenses`, `setDataSheetFormats`) | Does not touch `append()` (deprecated, left as-is) or add a header row/migration | Unit tests for each changed method's new column-E branch; manual check against a real sheet: add one debt and one non-debt expense, confirm column E has amount/blank respectively | Stage 1 |
| 3 | `createDataSheet()` creates new sheets with 5 columns | Only changes the literal passed for new sheets; does not migrate existing sheets | Manual check: run setup flow, confirm the created sheet has 5 columns | Stage 1 |
| 4 | Add-expense form gets the "in debt" checkbox, wired to `expense.isInDebt`, included in `form.resetForm(...)` | Does not add an edit flow | Manual check: submit with checkbox checked/unchecked, confirm resulting row via Stage 2's manual check; checkbox resets to unchecked after submit | Stage 1, 2 |
| 5 | `isExpenseEqual()` compares `isInDebt` | Treats `undefined` and `false` as equivalent (see Decisions) | Extended `index.spec.ts` cases pass | Stage 1 |
| 6 | Expenses table displays the debt flag as a column | Read-only display; no inline editing of the flag from the table | Manual check: expenses loaded via `loadExpenses`/`loadLastExpenses` show the correct flag per row | Stage 1, 2 |

Stages 2–6 can be implemented in parallel once Stage 1 lands, since they all only depend on the `Expense.isInDebt` field existing.

### Data flow

```mermaid
graph LR
    A["User checks 'in debt' + submits form"] --> B["dashboard-page.container: expense.isInDebt = true"]
    B --> C["AppActions.addExpense"]
    C --> D["addExpense$ effect"]
    D --> E["spreadsheetService.addExpense(): writes A-D as today + E = amount"]
    E --> F["loadExpenses dispatched to refresh state"]
    F --> G["spreadsheetService.loadExpenses(): reads A-E, maps E -> isInDebt"]
    G --> H["store.expenses updated"]
    H --> I["expenses-table renders 'In Debt' column"]
```

### State machine

Not applicable — `isInDebt` is a per-row boolean flag set once at creation, not a lifecycle with transitions (no edit flow exists).

---

## Decisions

### Column E value when unchecked

- **Option A:** Write `0` to column E for every row.
- **Option B:** Leave column E blank when `isInDebt` is falsy.
- **Chosen:** B
- **Why:** Confirmed with user — blank is cleaner for spreadsheet formulas (e.g. `SUM(E:E)`) and avoids a column full of zeros for the common non-debt case.

### Read-back scope

- **Option A:** Write-only — only `addExpense` writes column E; `loadExpenses`/`loadLastExpenses` untouched.
- **Option B:** Full read/write — also parse column E back into `Expense.isInDebt` in both load methods, and surface it in the expenses table.
- **Chosen:** B
- **Why:** Confirmed with user. Without read-back, the flag would vanish on every reload (the `addExpense$` effect always re-fetches from the sheet after writing), making the checkbox pointless beyond the initial write.

### `isExpenseEqual` and delete matching

- **Option A:** Leave `isExpenseEqual` unchanged; document as a known gap.
- **Option B:** Add `isInDebt` to the comparison so `deleteExpense$` can't match the wrong row.
- **Chosen:** B
- **Why:** Confirmed with user. Two expenses on the same day with identical category/comment/amount/date but different debt flags are otherwise indistinguishable to the delete matcher, which could delete the wrong row.

### How `isInDebt` is derived on read

- **Option A:** Store the debt amount separately (`debtAmount?: number`) and derive `isInDebt` from its presence.
- **Option B:** Store only `isInDebt?: boolean`, derived from whether column E has a value; the amount is always assumed equal to `expense.amount` per the goal statement.
- **Chosen:** B
- **Why:** The feature explicitly writes "the same money amount" into column E — there is no case where the debt amount differs from the expense amount, so a second numeric field would be redundant state that could drift from `amount`.

---

## Scope boundaries

- NOT included: editing an existing expense's debt flag — no edit flow exists in the app today for any expense field.
- NOT included: backfilling/migrating column E for rows that already exist in a sheet before this feature ships — those rows simply read back as `isInDebt: undefined`/not-in-debt.
- NOT included: adding a header row/label for column E, or for any existing column — the app writes no header row today.
- NOT included: updating the deprecated `append()` method in `spreadsheet.service.ts`.
- NOT included: any spreadsheet-side formula/summary (e.g. a running total of column E) — this spec only covers the app writing/reading the column.
- NOT included: adding automated tests for `dashboard-page.container.ts`, `setup-page.container.ts`, `app.effects.ts`, or `app.reducers.ts` — none exist today for these files and this feature doesn't introduce new branching logic in them that would justify starting that coverage now.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Column-mapping is hardcoded positionally in 5 separate places in `spreadsheet.service.ts`; missing one when adding column E causes silent data corruption (e.g. amount written into what a later read assumes is the debt column) | Wrong data in existing rows, or misread debt flags | Explicit per-method checklist in Stage 2; manual verification against a real sheet before merging |
| `loadExpenses()`'s gviz response omits `c[4]` entirely for historical rows (rather than returning an empty cell object), depending on how Google Sheets' Visualization API handles sparse trailing columns | Runtime error (`row.c[4].v` on `undefined`) instead of `isInDebt: false` | Guard the column-E read with an optional-chaining check (`row.c[4]?.v`) in both `loadExpenses` and `loadLastExpenses`, mirroring the existing `comment` optional handling at line 309/268 |
| ~~Existing sheets created before this feature have `columnCount: 4`~~ — resolved: existing data sheets' column count has already been bumped to 5 manually (out of band, not via app code) | ~~Debt checkbox silently fails to persist on pre-existing user sheets~~ — no longer a risk | No code change needed; still worth a quick manual check during Stage 2 that `addExpense`/`loadExpenses` behave correctly against one of these manually-updated sheets, since they were never exercised with 5 columns before |

---

## Open questions

Both resolved:

- ~~Does writing to column E on a sheet with `columnCount: 4` (created before this feature) actually succeed via the Sheets API, or does it require expanding `gridProperties.columnCount` first?~~ — **Resolved:** existing data sheets' column count has already been updated manually (out of band) to accommodate column E. No migration code is needed; see updated Risks entry.
- ~~What label/rendering should the expenses-table column use?~~ — **Resolved:** the column only appears when at least one visible row has the flag set, same as every other optional column today. This is exactly the existing `hasData()` auto-hide behavior already described in Modules and interfaces affected / Stage 6 — no new mechanism needed, just add `'isInDebt'` to `DEFAULT_COLS` and let `hasData()`/`isColHidden()` handle visibility. No always-visible variant is needed.

---

## Dependencies

- Existing production data sheet(s) have already had their column count manually bumped to accommodate column E — done out of band by the sheet owner, prior to this spec. No app-side migration depends on this; it's a precondition already satisfied.

---

## Test strategy

| ID | Scenario | How to verify |
|----|----------|---------------|
| **[AC1]** | Add expense with "in debt" checked | `spreadsheet.service.spec.ts`: `addExpense()` writes `numberValue: expense.amount` into the column-E cell. Manual: submit form with checkbox checked, inspect the sheet row — column E equals the amount in column C. |
| **[AC2]** | Add expense with "in debt" unchecked | `spreadsheet.service.spec.ts`: `addExpense()` writes no value (or an empty `userEnteredValue`) into the column-E cell. Manual: submit form unchecked, confirm column E is blank on that row. |
| **[AC3]** | Reload after adding a debt expense | `spreadsheet.service.spec.ts`: `loadExpenses()`/`loadLastExpenses()` map a populated column-E cell to `isInDebt: true`. Manual: after add, confirm the expenses table shows the debt indicator for that row without a page refresh (relies on the existing `loadExpenses` re-fetch in `addExpense$`). |
| **[AC4]** | Historical row with no column E at all | `spreadsheet.service.spec.ts`: mocked response omitting the 5th value/cell maps to `isInDebt: undefined`/falsy, no thrown error. |
| **[AC5]** | Delete a debt expense when a non-debt expense exists with identical category/comment/amount/date | `index.spec.ts`: `isExpenseEqual` returns `false` for two such expenses differing only in `isInDebt`, and `true` when both are falsy (`undefined` vs `false`). Manual: create both rows, delete the debt one, confirm the correct row is removed from the sheet. |
| **[AC6]** | Form reset after submit | Manual: submit with checkbox checked, confirm checkbox is unchecked for the next entry (per `form.resetForm({..., isInDebt: false})`). |

---

## Definition of Done

Scope: the whole feature (Stages 1–6). Based on the minimal DoD template — four
sections, no Security/Documentation/Migrations blocks, because this slice adds one
optional boolean field, touches no auth or PII, and ships no migration code.

An item may only be ticked when the named evidence exists. Sections 1–3 are
machine-checkable; section 4 is not, and nothing in the chain may tick it.

### 1. Spec compliance

- [ ] **[AC1]** debt expense writes `amount` into column E — covered by
      `spreadsheet.service.spec.ts` (`addExpense`, `isInDebt: true` case) — passing
- [ ] **[AC2]** non-debt expense leaves column E empty, and does not write `0` —
      covered by `spreadsheet.service.spec.ts` (`addExpense`, `isInDebt: false` and
      `undefined` cases) — passing
- [ ] **[AC3]** column E is read back into `isInDebt` — covered by
      `spreadsheet.service.spec.ts`, one case per load method (`loadLastExpenses`
      range `A1:E{take}`, `loadExpenses` gviz `select A, B, C, D, E`) — passing
- [ ] **[AC4]** a row with a missing 5th cell maps to a falsy `isInDebt` and throws
      nothing — covered by `spreadsheet.service.spec.ts`, mocked response without
      `c[4]`, in both load methods — passing
- [ ] **[AC5]** `isExpenseEqual` compares the debt flag, and treats `undefined` and
      `false` as equal — covered by `index.spec.ts` (both values differ → `false`;
      `undefined` vs `false` → `true`) — passing

[AC6] (form reset) is verified by the manual checks in section 4. It has no
automated test, because this spec adds no test file for
`dashboard-page.container.ts`.

### 2. Harness

- [ ] `npx tsc --noEmit` — exits 0
- [ ] `npx ng lint` — exits 0
- [ ] `npx ng test --watch=false --browsers=chromiumHeadless` — all specs pass
- [ ] `npx ng build` — exits 0

`ng build` is required for this slice, not optional: Stages 4 and 6 change two
templates (`dashboard-page.container.html`, `expenses-table.component.html`), and a
broken binding there can pass unit tests but fail the production build.

Deliberately not required for this slice: dependency audit (no new packages),
contract tests (no new external API — the Sheets endpoints are already in use),
mutation testing, and dead-code checks.

### 3. Scope discipline

- [ ] the deprecated `append()` in `spreadsheet.service.ts` is unchanged —
      confirmed not in diff
- [ ] no header row or column label is written anywhere — confirmed not in diff
- [ ] no backfill or migration code for rows that already exist — confirmed not in
      diff
- [ ] no edit flow for an existing expense's debt flag — confirmed not in diff

The first item is the risky one: column mapping is positional in five places in
`spreadsheet.service.ts`, so anyone updating "every place that writes a row" is
likely to touch `append()` as well.

### 4. Human-only

The orchestrator cannot tick these. If they are still open when the iteration
budget runs out, the orchestrator stops and reports.

- [ ] Owner (Oleh Piankov) approved this DoD before the chain started
- [ ] Manual check on a **fresh** sheet created by the current `createDataSheet()`:
      add one debt expense and one non-debt expense, confirm column E holds the
      amount and stays blank respectively
- [ ] Manual check on an **existing** sheet whose `columnCount` was bumped to 5 out
      of band: same two adds, plus one delete of a debt expense while a non-debt
      twin exists, confirm the correct row is removed
- [ ] Manual check of the gviz sparse-column case against real data (this is the
      open "Uncertain" terminal below): load a sheet with historical rows written
      before this feature, confirm no runtime error and no debt indicator on them

### Budget and stop conditions

- Attempts per stage: 2. A third attempt needs a human decision.
- Work in progress: the manual checks in section 4 all run against a single real
  spreadsheet, so integration evidence is a queue of one, whatever the code stages
  do in parallel.
- Stop on no progress: the same failed check with the same proposed fix twice.
- Stop on oscillation: a plan that goes A → B → A.
- Stop on contradiction: keep the failing evidence as it is, do not overwrite it,
  and escalate to the owner.

---


## Terminals and escalation

| Terminal | Required record | Next decision |
|---|---|---|
| Succeeded | All Stage 2 manual checks pass against both a fresh sheet and the manually-updated existing sheet; new unit tests pass | Merge and ship |
| Blocked / failed | — (prior column-count blocker resolved via manual sheet update) | — |
| Uncertain | gviz sparse-column behavior for `loadExpenses()` is unconfirmed until tested against a real spreadsheet | Verify against a real sheet before considering Stage 2 done |
| Cancelled / exhausted | — | — |

## Handoff state

- **Completed:** Spec drafted and decisions confirmed with the feature owner; both open questions resolved (existing sheets' column count updated manually out of band; expenses-table column uses the existing auto-hide behavior). No code written yet.
- **Current terminal:** working (spec stage; awaiting approval to implement)
- **Contradictions or uncertainty:** none outstanding. Only remaining unknown is the gviz sparse-column edge case, covered by the Risks table and Test strategy, not blocking.
- **Next safe action:** implement Stage 1 (`Expense.isInDebt`), then proceed through Stages 2–6; no external blocker remains.
- **Escalate to:** n/a — no open blockers.
