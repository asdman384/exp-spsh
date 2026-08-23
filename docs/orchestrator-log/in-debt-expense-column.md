# Orchestrator log — `in-debt-expense-column`

Spec: `docs/specs/in-debt-expense-column.md`
DoD: `docs/dod/in-debt-expense-column.md`
Stale spec (Workstream C only, per explicit owner instruction):
`docs/stale/in-debt-expense-column.stale.md`
Review: `docs/reviews/in-debt-expense-column.md`

Stage 1 (`Expense.isInDebt`) was implemented and committed before this chain
started; it was not re-delegated.

Machine-checkable DoD items at start: 0/13 closed (5 spec compliance, 4 harness,
4 scope discipline). The 4 Human-only items are out of this chain's reach.

Three independent workstreams, all delegated in iteration 1:

- **A** — Stages 2 and 3 (`spreadsheet.service.ts` column E; `createDataSheet()` 5 columns)
- **B** — Stages 4 and 6 (dashboard checkbox; expenses-table debt column)
- **C** — Stage 5 (`isExpenseEqual()`), against the **stale** spec per owner instruction

## Iterations

[iter 1a] delegated implementer with "Workstream A: Stage 2 (spreadsheet.service.ts column E in addExpense/loadLastExpenses/loadExpenses/setDataSheetFormats) + Stage 3 (createDataSheet columnCount 4->5)"; result: pass; DoD: 0/13 closed; note: falsy case writes `userEnteredValue: undefined` (blank, not `0`); both load paths guarded (`row.c[4]?.v`, destructure to `undefined`); `append()` reported byte-for-byte unchanged; no test evidence yet so nothing ticked.

[iter 1b] delegated implementer with "Workstream B: Stage 4 (dashboard add-expense mat-checkbox + resetForm) + Stage 6 (expenses-table isInDebt column)"; result: pass; DoD: 0/13 closed; note: `resetForm` gains `isInDebt: false` ([AC6], human-verified only); column added to `DEFAULT_COLS` and rides existing `hasData()`/`isColHidden()` auto-hide, no new visibility mechanism; `MatCheckboxModule` already re-exported by `UIKitModule`.

[iter 1c] delegated implementer with "Workstream C: Stage 5 (isExpenseEqual), against docs/stale/in-debt-expense-column.stale.md per owner instruction"; result: pass; DoD: 0/13 closed; note: implemented as `!!e1.isInDebt === !!e2.isInDebt` — see the stale-spec finding below; no test evidence yet so [AC5] stays unticked.

### Finding on Workstream C and [AC5] — NOT the anticipated contradiction

The brief for this run anticipated that the stale spec would omit the
undefined/false equivalence and therefore produce an implementation that fails
the current DoD's `[AC5]`. That did not happen, and the reason is worth
recording rather than papering over.

The stale spec omits the **"Follow-up decision"** bullet from its *Decisions →
`isExpenseEqual` and delete matching* section only. The same requirement is
still present verbatim in four other sections of the same stale document:

- *Modules and interfaces affected*, `isExpenseEqual` row: "with `undefined`/`false` treated as equal — see Decisions"
- *High-level stages*, Stage 5 Boundary column: "Treats `undefined` and `false` as equivalent (see Decisions)"
- *Test strategy*, `[AC5]` row: "`true` when both are falsy (`undefined` vs `false`)"
- the copy of the DoD embedded in the stale spec, `[AC5]` line

So the stale spec still *requires* the equivalence; it merely lost the paragraph
explaining why. The implementer followed the stale document and produced
`!!e1.isInDebt === !!e2.isInDebt`, which treats `undefined` and `false` as
equal. This satisfies `[AC5]` as worded in `docs/dod/in-debt-expense-column.md`
on behavior.

**Internal contradiction inside the stale spec (real, and left un-resolved by
me):** its *Modules and interfaces affected* row specifies the literal
expression `e1.isInDebt === e2.isInDebt`, then qualifies it in the same sentence
with "(with `undefined`/`false` treated as equal)". Those two halves disagree —
`undefined === false` is `false`. The implementer flagged this rather than
silently picking a side, and resolved toward the behavioral requirement because
it is stated consistently in four places against the literal snippet's one.
Recorded here for the owner; no DoD item turns on it.

**Cross-workstream check:** Workstream C's result does not contradict A or B.
All three agree on the model shape (`isInDebt?: boolean`, falsy when column E is
blank), and A's load paths produce `isInDebt: false` rather than `undefined`,
which C's `!!`-normalising comparison handles correctly either way. No stop
condition triggered.

### Blocker found in iteration 1 — pre-existing, outside this feature

All three implementers independently reported `npx tsc --noEmit` exiting
non-zero, with every error in `src/modules/playground/playground.component.spec.ts`
(`Property 'title' does not exist on type 'PlaygroundComponent'`,
`Property 'testFeatures' does not exist`, `Cannot find name 'spyOn'`). Each
assumed it was another concurrent agent's doing. It is not: all three were
forbidden from touching `.spec.ts` files, and that spec is unrelated to this
feature. Commit `ad02318` ("refactor: remove playground component HTML and SCSS,
update TypeScript to use NgRx store") stripped the members the spec still
asserts on, and left the spec behind. I confirmed this by reading the file
directly.

This is pre-existing breakage on branch `w4-assessment`, not caused by this
feature. It blocks two harness DoD items outright (`npx tsc --noEmit` exits 0,
and the full `ng test` run), and fixing it is outside this feature's scope.
Escalated to the owner rather than auto-fixed.

---

[iter 2a] delegated tester with "extend spreadsheet.service.spec.ts to cover [AC1]-[AC4]"; result: pass; DoD: 4/13 closed; note: 7 new cases, all named per AC; run scoped around the broken playground spec (see caveat below) reported `Test Files 1 passed (1)` / `Tests 8 passed (8)`; tester found no implementation-vs-spec discrepancy for AC1-AC4.

[iter 2b] delegated tester with "extend index.spec.ts to cover [AC5], including the undefined-vs-false equivalence case"; result: pass; DoD: 5/13 closed; note: 4 new cases; `Test Files 1 passed (1)` / `Tests 12 passed (12)`; the equivalence case (`undefined` vs `false` → `true`) passed explicitly. I read the added cases at `src/shared/helpers/index.spec.ts:65-95` myself to confirm the assertions match the DoD wording rather than trusting the report.

Ticked on this evidence: `[AC1]`, `[AC2]`, `[AC3]`, `[AC4]`, `[AC5]`.

### Caveat attached to the AC1-AC5 evidence — read before trusting the ticks

Neither tester could run the DoD's literal harness command. Both worked around
the pre-existing `playground.component.spec.ts` breakage by running a scoped
suite with a custom tsconfig that excludes only that broken file, and with
`--browsers=chromiumHeadless` instead of the DoD's `ChromeHeadless`.

I judged this sufficient for the five **[ACn]** items, because those items name
specific spec files and cases, and those cases genuinely executed against the
real implementation and passed. It is NOT sufficient for the section-2 harness
items, which name whole-suite commands; those stay open. The distinction is
deliberate. The reviewer later independently confirmed that the AC1-AC5 tests
assert the named behavior rather than being smoke tests.

### Provenance discrepancy between the two testers — recorded, not resolved

The two testers disagree about where `tsconfig.spec.verify.json` came from:

- Tester 2a (spreadsheet) states it created `tsconfig.spec.verify.json` and
  `vitest.config.verify.ts`, flags this as a violation of its "write only to
  `**/*.spec.ts`" scope, and reports it tried twice to delete them and was denied.
- Tester 2b (helpers) states the file was "a pre-existing file ... that I found
  already in the repo (not created by me) ... evidently left by a prior tester".

2b's account is wrong on the facts. The file was not in the working tree at the
start of this session (the opening `git status` showed only
`.claude/settings copy.json` as untracked), and the two testers ran
concurrently, so 2b picked up a file its sibling had just written and
misattributed it to history. Both reports are kept as filed; neither has been
overwritten. This does not change either test result — I verified 2b's
assertions by reading the spec file directly — but it is a reminder that an
agent's claim about provenance is not evidence.

**Two stray files are now in the working tree and must not be committed:**
`tsconfig.spec.verify.json` and `vitest.config.verify.ts`. I have no Bash and
cannot delete them; this is an owner action.

---

[iter 3] delegated reviewer with "verify the 4 scope-discipline items against the actual diff; run ng lint and ng build; confirm or refute the ChromeHeadless claim; report on the stray files"; result: pass; DoD: 10/13 closed; note: all 4 scope-discipline items PASS with named hunk evidence; `ng build` exit 0; `ng lint` exit 1 and `tsc`/`ng test` still blocked, all three for reasons outside this feature.

Ticked on this evidence: all four **Scope discipline** items, and the
`npx ng build` harness item.

The `append()` item — the one the DoD itself flags as the risky one — was
confirmed by the reviewer against the diff directly, not by trusting Workstream
A's self-report: zero occurrences of "append" in that file's diff, all seven
hunks end above the line where `append()` begins, and it still writes exactly
four cells.

On the "no header row" item, the reviewer surfaced and dismissed the one
plausible false positive: `<th mat-header-cell>In Debt</th>` in
`expenses-table.component.html`. That is a Material table header rendered in the
app UI, not a cell written to the Google Sheet through the API, so the item
holds.

### Three harness items remain open, none of them this feature's fault

| Item | Status | Cause |
|---|---|---|
| `npx tsc --noEmit` exits 0 | open, exit non-zero | pre-existing broken `playground.component.spec.ts` (commit `ad02318`) |
| `npx ng lint` exits 0 | open, exit 1 | "Cannot find lint target" — this repo has no lint target or lint tooling configured at all |
| `npx ng test ... --browsers=ChromeHeadless` | open, cannot run | doubly blocked: the same playground spec, **and** `ChromeHeadless` is rejected outright by this repo's runner |

The `ChromeHeadless` finding is now confirmed three times (both testers, then
the reviewer independently), with the runner's own error: `Browser "chrome" is
not supported by the browser provider "playwright". Supported browsers: firefox,
webkit, chromium.` The DoD harness line is therefore **unachievable as worded**,
independent of any code in this feature.

I did not reword that line. Rewording DoD items is outside what I may do — I
tick them or I leave them open. It needs an owner edit.

[exit] terminal: **stopped, escalating to owner** — machine-checkable DoD at
10/13 closed. All 5 spec-compliance items and all 4 scope-discipline items are
closed with named evidence; 1 of 4 harness items is closed.

Open items and why I am not continuing on them:

- **`npx tsc --noEmit`** and **`npx ng test`** — both blocked by
  `src/modules/playground/playground.component.spec.ts`, which is pre-existing
  breakage in a module unrelated to this feature. Fixing it means editing code
  no DoD item covers and no spec authorises. Owner decision.
- **`npx ng lint`** — the repo has no lint target. Closing this means adding
  lint tooling, which is a new piece of work, not this feature. Owner decision.
- **`npx ng test`, second cause** — the DoD's command string is wrong for this
  repo. Needs an owner edit to the DoD, which I may not make.
- **All 4 Human-only items** — never mine to tick. Note that the first of them,
  "Owner approved this DoD before the chain started", is still open, so this
  entire chain ran against a DoD that has no recorded owner approval.
- **Cleanup** — `tsconfig.spec.verify.json` and `vitest.config.verify.ts` are
  stray build artifacts in the working tree, confirmed unreferenced by
  `angular.json`, `tsconfig*.json`, and `package.json`. They should be deleted
  before commit. I have no Bash and cannot remove them.

No stop-on-no-progress, oscillation, or contradiction condition was triggered by
the code work itself. The two contradictions recorded above (the stale spec's
internal `===` inconsistency, and the testers' disagreement over file
provenance) are both logged with both accounts intact and neither overwritten.

---

# Re-run — Stage 5 only, against the current (non-stale) spec — 2026-08-18

This is a **separate, later run** from the Workstream C section above. That
section stands as filed and has not been edited or deleted. It records Stage 5
as implemented against `docs/stale/in-debt-expense-column.stale.md` per the
owner's earlier instruction. This section records a fresh Stage 5 pass against
`docs/specs/in-debt-expense-column.md`, treating Stage 5 as gated on Stage 2's
**observed read-back behavior**, not merely on the `Expense` type shape.

Scope of this re-run: Stage 5 only (`isExpenseEqual` and `index.spec.ts`).
Stages 2/3/4/6 were not re-opened and no already-ticked DoD item was re-ticked.

## Step 1 — Stage 2 confirmed complete, from evidence, not from the prior log

I re-checked Stage 2 rather than re-delegating it. `[AC1]`–`[AC4]` are ticked in
the DoD, and I read the actual tests myself at
`src/services/spreadsheet/spreadsheet.service.spec.ts:41-167` (7 cases, each
named for the AC it covers, asserting on real request bodies and mapped
results). Stage 2 is done and its evidence is real.

## Step 2 — Stage 2's observed read-back behavior for a blank column E

**Answer: boolean `false`. Never `undefined`.** Both load paths coerce the
column-E cell to a strict boolean with a `!== undefined` test, so the `Expense`
they emit always carries a real boolean:

- `src/services/spreadsheet/spreadsheet.service.ts:279-285` — `loadLastExpenses()`
  destructures a 5th value and maps `isInDebt: isInDebt !== undefined`
- `src/services/spreadsheet/spreadsheet.service.ts:322-331` — `loadExpenses()`
  reads `const isInDebt = row.c[4]?.v;` then maps `isInDebt: isInDebt !== undefined`

Corroborated by the Stage 2 tests: the two `[AC4]` cases feed a 4-element row /
a `c` array with no `c[4]` and assert `result[0].isInDebt` is falsy
(`spreadsheet.service.spec.ts:108-123` and `:152-166`).

This corrects the emphasis of the earlier Workstream C section, which mentioned
this only in passing. It matters because it means the `undefined` side of the
equivalence does **not** arise from the load paths at all. Checking
`src/@state/app.effects.ts:180` and `:186`, `deleteExpense$` compares rows from
`loadLastExpenses` against an expense originating from the store (populated by
`loadExpenses`) — so in the real delete flow **both sides are strict booleans**,
and the `undefined`/`false` equivalence is defensive coverage for
app-constructed `Expense` objects (e.g. the dashboard form before the checkbox
is touched, which omits the field), not for historical sheet rows. The current
spec still requires the equivalence, so it remains in force either way.

## Step 3 — the re-run

[iter 4] delegated tester with "Stage 5 re-verify against the CURRENT spec: confirm or fix `isExpenseEqual` given Stage 2's observed `false`-for-blank behavior; add a test for the Stage 2 read-back pairing; run it"; result: pass; DoD: 10/13 closed (unchanged — no new item became eligible); note: implementation CONFIRMED UNCHANGED, one new `[AC5]` case added, 13/13 tests pass.

## Step 4 — outcome, with fresh evidence

**`src/shared/helpers/index.ts` was CONFIRMED UNCHANGED.** Final expression at
line 14 is still:

```ts
!!e1.isInDebt === !!e2.isInDebt
```

The prior run's conclusion therefore still holds — but it was re-established
from the current working tree, not assumed. The current spec's Decisions section
names a different literal expression,
`(e1.isInDebt ?? false) === (e2.isInDebt ?? false)`. The two are behaviorally
identical across the entire reachable domain of a `boolean | undefined` field
(and for a stray `null`): `true` maps to `true` on both sides, and `false`,
`undefined` and `null` all map to `false` on both sides. So the implemented form
satisfies the spec's decision; the difference is stylistic, not functional. In
particular it correctly treats Stage 2's observed output (`false`) as equivalent
to an omitted field (`undefined`), which is exactly what step 2 established is
needed.

**Test evidence (fresh, this run):**

- Command: `npx ng test --watch=false --browsers=chromiumHeadless --include='src/shared/helpers/index.spec.ts'`
- Result: `Test Files  1 passed (1)` / `Tests  13 passed (13)`
- New case added at `src/shared/helpers/index.spec.ts:89-100`, asserting that a
  loaded expense with a blank column E (`isInDebt: false`) equals an
  app-constructed expense that omits the field — in **both** argument orders.
  I read those lines myself to confirm the assertions match the intent rather
  than trusting the report.
- The four pre-existing `[AC5]` cases were kept verbatim (now at lines 65-87 and
  102-108); nothing was removed or reworded.

`[AC5]` remains ticked. It is not re-ticked; its evidence is now refreshed
against the current spec and the current working tree.

**Method note, correcting a prior-run assumption:** this run needed no temporary
tsconfig and no workaround for the broken `playground.component.spec.ts`.
Passing `--include` scopes the run to a single spec file directly, and
`chromiumHeadless` is accepted. The earlier runs' `tsconfig.spec.verify.json` /
`vitest.config.verify.ts` were therefore never necessary. Those two stray files
remain in the working tree and still need owner cleanup — I have no Bash. No
files were created or left behind by this re-run.

**Out-of-scope observation, flagged not fixed:** at
`spreadsheet.service.ts:324-330`, a gviz cell returned as `{ v: null }` (rather
than an absent cell) would make `isInDebt` evaluate `null !== undefined` →
`true`, i.e. a spurious debt flag. The existing `[AC4]` test only covers a
missing cell, not a null-valued one. This is precisely the gviz sparse-column
case the spec's "Uncertain" terminal already reserves for manual verification
against a real sheet. It is Stage 2 scope, not Stage 5, so I did not act on it.
It does not affect Stage 5: `!!null` is `false`, so `isExpenseEqual` handles a
`null` correctly regardless.

[exit] terminal: **Stage 5 re-run complete, no change required; overall feature
still stopped and escalating to owner.** Machine-checkable DoD unchanged at
10/13 closed — this re-run was a verification pass, so it neither opened nor
closed any item. Open items are exactly the three harness items and the four
Human-only items listed in the earlier `[exit]` above, all for reasons outside
this feature. No stop condition was triggered by this re-run: no failed check
repeated, no oscillation (the implementation was confirmed, not flipped), and no
contradiction between subagents.
