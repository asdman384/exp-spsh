# Review: `in-debt-expense-column`

Spec: `docs/specs/in-debt-expense-column.md`
DoD: `docs/dod/in-debt-expense-column.md`
Branch: `w4-assessment`
Diff reviewed: working-tree unstaged diff (`git diff`, i.e. HEAD `f5e1086` "checkpoint 1"
vs working tree). `git log --oneline` shows `f5e1086` sits on top of `5207a9b` and
already contains Stage 1 (`Expense.isInDebt`) plus the spec/DoD/agent-config docs, so
the unstaged working-tree diff is exactly Stages 2–6. Confirmed against
`git diff 5207a9b` as well, which shows the same Stage-1 files as already present and
everything else (`spreadsheet.service.ts`, both containers, `expenses-table.component.*`,
`index.ts`) as the delta.

Files changed in the reviewed diff:
`docs/dod/in-debt-expense-column.md` (checkbox state only), `docs/stale/in-debt-expense-column.stale.md`,
`src/modules/dashboard/dashboard/dashboard-page.container.html`,
`src/modules/dashboard/dashboard/dashboard-page.container.ts`,
`src/modules/setup/setup-page/setup-page.container.ts`,
`src/services/spreadsheet/spreadsheet.service.spec.ts`,
`src/services/spreadsheet/spreadsheet.service.ts`,
`src/shared/components/expenses-table/expenses-table.component.html`,
`src/shared/components/expenses-table/expenses-table.component.ts`,
`src/shared/helpers/index.spec.ts`,
`src/shared/helpers/index.ts`.

---

## Part 1 — Scope discipline (DoD section 3)

### 1. "the deprecated `append()` in `spreadsheet.service.ts` is unchanged" — PASS

Search run: `git diff -- src/services/spreadsheet/spreadsheet.service.ts | grep -n "append"`
→ no output. Also grepped the hunk headers of that file's diff:

```
@@ -168,6 +168,17 @@   @@ -181,6 +192,7 @@   @@ -235,7 +247,8 @@
@@ -254,7 +267,7 @@   @@ -263,11 +276,12 @@  @@ -282,7 +296,7 @@
@@ -307,11 +321,13 @@
```

The last hunk ends at old-line 320 / new-line 334. `append()` is defined at line 343
onward in the current file (`/** @deprecated */ append(sheetId: number, expense:
Array<Expense>) { ... 4 cells written ... }`), well outside every hunk range, and it
still writes exactly 4 cells (category, comment, amount, date-serial) — no 5th
column-E value added. Byte-for-byte unchanged.

**Verdict: PASS.**

### 2. "no header row or column label is written anywhere" — PASS

Search run: `git diff | grep -inE "header|label|column.*(name|title)"`. One hit:

```
367:+    <th mat-header-cell *matHeaderCellDef>In Debt</th>
370:+        <mat-icon aria-label="In debt">check</mat-icon>
```

Both are in `src/shared/components/expenses-table/expenses-table.component.html`
(Stage 6, confirmed by reading the full diff of that file) — an Angular Material
`<table mat-table>` UI header cell for the in-app read-only display table, not a
header row/label written to the Google Sheet via the Sheets API. No hits anywhere in
`spreadsheet.service.ts` or `setup-page.container.ts` (the only files that talk to the
Sheets API for row/sheet creation). This matches the spec's own framing — the
DoD/spec text about "no header row" is explicitly about the spreadsheet, per the
spec's Assumptions section ("Existing data sheets have no header row … no header cell
to add for column E").

**Verdict: PASS.**

### 3. "no backfill or migration code for rows that already exist" — PASS

Search run: `git diff | grep -inE "migrat|backfill|existing.*row|for\s*\(.*row"` → no
output at all. No loop over existing rows, no migration function, nothing that
touches historical data. The load-side changes (`row.c[4]?.v`, destructuring a 5th
tuple element) are read-time mapping for whatever comes back from the API, not
write-time backfill.

**Verdict: PASS.**

### 4. "no edit flow for an existing expense's debt flag" — PASS

Search run: `git diff | grep -inE "edit|update.*expense|patch"` → 3 hits, all
pre-existing dispatch calls unrelated to editing an expense:
`AppActions.addExpense(...)` (add, not edit), `AppActions.upsertDataSheet(...)` and
`AppActions.setCurrentSheet(...)` (both in `setup-page.container.ts`'s
`createDataSheet()`, Stage 3, about sheet creation, not expense editing). Full diffs
of `dashboard-page.container.ts/.html` and `setup-page.container.ts` confirm the only
behavioral additions are: a `mat-checkbox` bound to `expense.isInDebt` on the
add-expense form, `isInDebt: false` added to `form.resetForm(...)`, and the
`createSheet(...)` column-count literal changed `4` → `5`. No new component, route,
button, or store action for modifying an already-submitted expense's debt flag.

**Verdict: PASS.**

---

## Part 2 — Stray files

### `tsconfig.spec.verify.json` / `vitest.config.verify.ts`

Checked references in `angular.json`, `tsconfig.json`, `tsconfig.app.json`,
`tsconfig.spec.json`, `package.json` scripts, and via a repo-wide grep for
`tsconfig\.spec\.verify|vitest\.config\.verify`.

- `angular.json`'s `test` architect target references `tsconfig.spec.json` and
  `runnerConfig: vitest.config.ts` — the real config files, not the `.verify` ones.
- `package.json` has no script referencing either file.
- The only repo hit for the filenames is `docs/orchestrator-log/in-debt-expense-column.md`
  (prose describing them), plus `package-lock.json` matching on an unrelated
  substring ("verify" appears in some dependency's metadata, not these filenames).
- No `.ts`/`.json` source file imports or extends either file.

**Conclusion: neither file is wired into the app build or the standard test
target. Deleting both would not break `ng build`, `ng test`, or any `npm` script.**
They were only usable by explicitly passing `--ts-config=tsconfig.spec.verify.json`
on the command line, which nothing in the committed config does. I did not delete
them (out of scope for this review); this is confirmation only.

### Other stray/untracked files

- `docs/orchestrator-log/in-debt-expense-column.md` — untracked, but this is the
  orchestrator's own log for this feature chain, i.e. legitimate process output, not
  application code. Not flagged as a problem, just noting it is untracked.
- `.claude/settings copy.json` — untracked, present in the working tree, **not**
  created during this chain (it was already listed as `??` in the very first
  `git status` snapshot at the start of the session, before any of Stages 2–6 work).
  It is a leftover editor-created backup of `.claude/settings.json` (identical
  `permissions`/`hooks` shape). Unrelated to this feature but still a stray untracked
  file sitting in the repo root; flagging for cleanup, not blocking this feature's DoD.
- No other untracked files were found (`git status --porcelain=v1 --untracked-files=all`
  showed only the three items above plus the two `.verify` files).

---

## Part 3 — Harness

### `npx ng lint` — exit code **1**, NOT a feature failure

Output: `Cannot find "lint" target for the specified project. ... For example: ESLint:
ng add angular-eslint`.

This is a repo-wide configuration gap, not something introduced or touched by this
diff: `angular.json`'s `architect` block for the `exp-spsh` project has no `lint`
target defined at all (only `build`, `serve`, `extract-i18n`, `test`), and
`package.json` has no ESLint/`angular-eslint` devDependency and no `lint` script.
This diff does not add, remove, or modify any lint configuration. **Attribution:
pre-existing repo gap, unrelated to this feature.** The DoD's `npx ng lint — exits 0`
harness item is not achievable until lint tooling is added to the project at all —
that is a repo-level gap, not something this feature's diff broke.

### `npx ng build` — exit code **0**, PASS

Full build succeeded (`Application bundle generation complete.`), including the two
templates Stages 4 and 6 touched
(`dashboard-page.container.html`, `expenses-table.component.html`) — both compiled
with no broken bindings. Output included one pre-existing, unrelated budget warning
(`src/fun/snow/snow.component.scss exceeded maximum budget`), which has nothing to do
with this feature. `ng build` excludes spec files by default, so the pre-existing
broken `playground.component.spec.ts` did not surface here, as expected.

**Verdict: `ng build` is clean evidence that Stage 4/6 template bindings compile.**

### `ChromeHeadless` claim — CONFIRMED

Ran `npx ng test --watch=false --browsers=ChromeHeadless --ts-config=tsconfig.spec.verify.json
--exclude="src/modules/playground/**"` (the only way to get the build past the
pre-existing broken playground spec far enough to reach browser-provider
initialization). Result:

```
Error: [exp-spsh (chrome)] Browser "chrome" is not supported by the browser
provider "playwright". Supported browsers: firefox, webkit, chromium.
```

This confirms, independently of the two testers' reports, that this project's `ng
test` (builder `@angular/build:unit-test`, runner `vitest`, browser provider
`playwright`) rejects `ChromeHeadless`/`chrome` outright and only accepts `firefox`,
`webkit`, `chromium`. `angular.json`'s own `test` target already uses
`"browsers": ["chromiumHeadless"]`, consistent with this. Note: Angular's own
`ng test --help` text is misleading here — it uses `ChromeHeadless` as a generic
example of the "Headless" naming convention, but that does not mean this project's
configured provider (playwright) supports Chrome.

**Verdict: the DoD's literal harness line (`npx ng test --watch=false
--browsers=ChromeHeadless`) is unachievable as worded in this repo, independent of
the pre-existing playground breakage. This is a DoD-wording problem, not something
the implementation chain can fix in code.**

Separately (context, not a Part 3 requirement): the full unscoped `npx ng test
--watch=false --browsers=ChromeHeadless` (no exclusions) fails earlier still, at the
build/type-check step, on the pre-existing broken
`src/modules/playground/playground.component.spec.ts` (`TS2339: Property 'title'
does not exist on type 'PlaygroundComponent'`, etc. — introduced by commit `ad02318`,
unrelated to this feature, as previously reported by the tester agents and confirmed
by reading that file). This corroborates the orchestrator log's account.

---

## Part 1 (spec compliance / AC evidence check — DoD section 1)

Not explicitly requested as a separate part, but load-bearing for the overall
verdict, so recorded here:

- **[AC1]/[AC2]** (`spreadsheet.service.spec.ts`, `addExpense() column E` describe
  block): tests genuinely assert on `req.request.body.requests[1].updateCells.rows[0].values[4].userEnteredValue`,
  checking `{ numberValue: expense.amount }` for `isInDebt: true`, and `toBeUndefined()`
  + explicit `not.toEqual({ numberValue: 0 })` for `false` and `undefined`. This is
  real behavioral evidence, not a smoke test. **AC1/AC2 evidence exists.**
- **[AC3]/[AC4]** (`loadLastExpenses()` and `loadExpenses()` describe blocks): tests
  assert the request URL contains `A1:E{take}` / gviz `select A, B, C, D, E`, and
  assert `result[0].isInDebt` truthy/falsy for populated vs. missing 5th
  cell/`c[4]`, plus `thrown` stays `undefined` for the sparse-column case. **AC3/AC4
  evidence exists**, for both load methods.
- **[AC5]** (`index.spec.ts`): 4 new cases explicitly named `[AC5]`, covering
  true-vs-false (false), true-vs-undefined (false), undefined-vs-false (true, the
  equivalence case), true-vs-true (true). The implementation
  (`!!e1.isInDebt === !!e2.isInDebt` in `src/shared/helpers/index.ts`) matches this
  behavior. **AC5 evidence exists and matches the implementation.**
- Note: `docs/dod/in-debt-expense-column.md` in the working tree already has AC1–AC5
  ticked (`[x]`), added on top of the committed "checkpoint 1" version (`f5e1086`)
  which had them unticked. Per the orchestrator log
  (`docs/orchestrator-log/in-debt-expense-column.md`), this ticking was done by the
  orchestrator after the tester evidence above was produced, which is consistent with
  this task's rule ("the orchestrator ticks," not sub-agents). I did not tick
  anything myself.

---

## Items I could not verify

- **Section 4 (human-only) manual checks** — fresh-sheet check, existing
  (out-of-band column-bumped) sheet check with delete, and gviz sparse-column check
  against a real spreadsheet. These require a live Google Sheet and human/manual
  execution; I have no access to a real spreadsheet and did not attempt them. They
  remain open, as the DoD itself says only a human can close them.
- **`npx tsc --noEmit`** — not one of the two harness commands Part 3 asked me to
  run, so I did not run it myself as a required check; I rely on the orchestrator
  log's and testers' consistent report (which I did not independently reproduce
  end-to-end) that it fails solely on the pre-existing `playground.component.spec.ts`
  breakage. I did independently reproduce the equivalent failure via the unscoped
  `ng test` build step above, which hits the same TypeScript errors in the same file,
  corroborating but not identically reproducing the bare `tsc --noEmit` command.
- **Owner approval of the DoD** (section 4, first bullet) — not something I can
  check from the repo; no evidence either way.
- Whether the manually-bumped production sheet(s) mentioned in the spec's
  Dependencies section actually have `columnCount: 5` — this is an out-of-band,
  real-world precondition I cannot verify from the diff or local environment.

---

## Summary of verdicts

| Item | Verdict |
|---|---|
| Scope discipline 1 — `append()` unchanged | PASS |
| Scope discipline 2 — no header row/label written | PASS |
| Scope discipline 3 — no backfill/migration code | PASS |
| Scope discipline 4 — no edit flow for debt flag | PASS |
| Stray files `tsconfig.spec.verify.json` / `vitest.config.verify.ts` | Not referenced by build/test config anywhere; safe to delete without breaking anything (not deleted by me) |
| Other stray file | `.claude/settings copy.json` — pre-existing untracked leftover, unrelated to this feature |
| `npx ng lint` | Exit 1 — pre-existing repo gap (no lint target/tooling configured at all), not caused by this feature's diff |
| `npx ng build` | Exit 0 — PASS, including both Stage 4/6 templates |
| `ChromeHeadless` rejected | CONFIRMED independently — playwright provider only accepts `firefox`, `webkit`, `chromium`; DoD harness line is unachievable as worded regardless of the playground breakage |
| AC1–AC5 automated evidence | All genuinely exist and assert the named behavior (not smoke tests) |
