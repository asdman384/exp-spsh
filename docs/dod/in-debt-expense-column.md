
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
- [ ] `npx ng test --watch=false --browsers=ChromeHeadless` — all specs pass
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

