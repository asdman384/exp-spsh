# Definition of Done — Signal-based inputs, outputs, and view queries (`signal-inputs-outputs`)

Spec: `docs/specs/signal-inputs-outputs.md`
Created: 2026-09-11
Updated: 2026-09-11 (scope widened to include `@ViewChild`/`@ViewChildren`/`@ContentChild`/`@ContentChildren` migration on `StatisticsContainer`; AC5/AC12/AC13 reworded, AC14–AC19 added)

Sections 1–3 are ticked by the orchestrator from cited evidence. Section 4 is **human-only** — no agent may ever tick it.

An item without a concrete evidence pointer (a test name, a command result, a report file)
stays `- [ ]`. "I think it works" is not evidence.

---

## 1. Acceptance criteria

- [ ] [AC1] `bash scripts/harness.sh` is green — all four layers (lint, typecheck, build, test) — covered by `scripts/harness.sh` full run — not written
- [ ] [AC2] No `@Input(`, `@Output(`, or `EventEmitter` remain in `src/`; `ExpensesTableComponent` no longer imports or implements `OnChanges`/`SimpleChanges` — covered by `expenses-table.component.ts` source inspection / grep — not written
- [ ] [AC3] Exactly five `input()`-declared inputs (`showDateCol`, `dataSource`, `draggable`, `selectable`, `selected`) with unchanged names and defaults, none required — covered by `expenses-table.component.ts` source inspection — not written
- [ ] [AC4] Exactly three outputs with unchanged names/payload types; `deleteRow`/`cellClick` via `output()`, `selectionChange` via `outputFromObservable()` deferred one macrotask per D1 — covered by `expenses-table.component.ts` source inspection — not written
- [ ] [AC5] Neither consumer template changes bindings; `dashboard-page.container.ts` untouched; the only edits to `statistics.container.ts` are the view-query ones (AC14–AC16) — covered by diff review of those files — not written
- [ ] [AC6] `columns` is a `computed()` over `dataSource()`, `selectable()`, `showDateCol()` preserving existing column rules — covered by `expenses-table.component.spec.ts` column tests — not written
- [ ] [AC7] `expenses-table.component.spec.ts` passes unmodified plus ≥2 new tests via `fixture.componentRef.setInput(...)` (columns for aggregate vs full rows; `selected` marks rows selected) — covered by `expenses-table.component.spec.ts` — not written
- [ ] [AC8] Manual browser check: Statistics rows pre-checked on first paint, Total correct, unticking lowers Total, drill-down/undo restores grouped view with checkbox column — **manual, human-only (see section 4)** — not written
- [ ] [AC9] Manual browser check: Dashboard swipe-delete still works, date column hidden, no row renders off-screen after refresh — **manual, human-only (see section 4)** — not written
- [ ] [AC10] `knowledge/interfaces/expenses-table-component.md` describes the signal API with real output names and no stale `ngOnChanges`-throws note — covered by diff review of that file — not written
- [ ] [AC11] `knowledge/flows/statistics.md` and `knowledge/flows/delete-expense.md` use real output names and drop the `ngOnChanges` attribution — covered by diff review of those files — not written
- [ ] [AC12] `knowledge/log.md` gains one dated entry naming every concept file touched, covering both the input/output half and the view-query half; no concept file narrates the change itself — covered by diff review of `knowledge/log.md` — not written
- [ ] [AC13] No file outside `src/shared/components/expenses-table/`, `src/modules/dashboard/statistics/`, `knowledge/`, and `docs/` is modified; `dashboard.routes.ts` and `statistics.container.html` byte-identical; `package.json`, `angular.json`, `eslint.config.js` untouched; no new `eslint-disable` — covered by `git diff --stat` review — not written
- [ ] [AC14] No `@ViewChild`/`@ViewChildren`/`@ContentChild`/`@ContentChildren`/`QueryList` remain in `src/`; `statistics.container.ts` no longer imports `ViewChild`, still imports `ElementRef` and `AfterViewInit` — covered by grep + source inspection — not written
- [ ] [AC15] `summaryTable` is an optional `viewChild('summaryTable', { read: ElementRef })`; `tableAnimation()` keeps its public modifier, exact signature, and class-toggling behavior; calling it before the view exists is a no-op, not a throw — covered by `statistics.container.ts` source inspection + AC17/AC18 tests — not written
- [ ] [AC16] `monthSelector` is `viewChild.required('monthSelector', { read: MatTabGroup })` (string locator, not class locator); `scrollToCurrentMonth()` unchanged apart from call syntax — covered by `statistics.container.ts` source inspection — not written
- [ ] [AC17] `statistics.container.spec.ts`'s original `should create` test is not weakened/deleted/rewritten and the file still passes; `fixture.detectChanges()` in `beforeEach` runs `ngAfterViewInit` without `NG0951`; new tests may be added to close AC15/AC16 coverage — covered by `statistics.container.spec.ts` — not written
- [ ] [AC18] Manual browser check: late-month entry auto-scrolls carousel, drill-down/undo plays straight/reverse animation, no stale `summary-table-*` class persists after navigating away and back, user/year carousels still work (i.e. `monthSelector` didn't bind to the wrong `mat-tab-group`) — **manual, human-only (see section 4)** — not written
- [ ] [AC19] `knowledge/flows/statistics.md` lines 77–78 describe `summaryTable` (optional) and `monthSelector` (required) signal view queries in present tense; `knowledge/architecture/routing-and-guards.md:49-51` left unedited — covered by diff review of those files — not written

## 2. Verification layers

- [ ] **Build / type-check** — `bash scripts/harness.sh --build` exits 0
- [ ] **Unit tests** — `bash scripts/harness.sh --test` exits 0, no new skipped suites
- [ ] **Full harness** — `bash scripts/harness.sh` exits 0 (this is the gate the reviewer re-runs)
- [ ] **Manual check in the running app** — required: this change is visible in the UI (Statistics table selection/Total, month-carousel auto-scroll, table animation, Dashboard swipe-to-delete). Two terminals: `npm run watch` and `npm run serve`, then http://localhost:4200/exp-spsh/. State what was clicked and what was observed.
      *An agent cannot tick this one — see section 4.*

## 3. Explicitly out of scope

- [ ] No behaviour changes visible to a user beyond the strict widening of column recomputation recorded as D3
- [ ] No renaming of any input or output (`deleteRow`, `cellClick`, `selectionChange` keep their names)
- [ ] No `model()` adoption, no new two-way bindings
- [ ] No changes to component selectors, component hierarchy, or import graph
- [ ] No changes to NgRx actions, reducers, effects, selectors, or store shape
- [ ] No `SelectionModel` replacement, no `StatisticsContainer`/`DashboardPageContainer` field-to-signal conversion, no `OnPush` adoption, no removal of `cd.detectChanges()` calls, no template-driven-to-reactive-forms conversion
- [ ] No conversion of `ngAfterViewInit` to an `effect()` (D8) — confirmed nothing found to migrate for `@ViewChildren`/`@ContentChild`/`@ContentChildren`/`QueryList` (D9)
- [ ] No change to the `canDeactivate` guard or to `tableAnimation()`'s public signature/null-tolerance
- [ ] No replacement of private Material APIs (`MatTabGroup._elementRef`/`._tabHeader`) — copied verbatim
- [ ] No new tests in `expenses-table.component.spec.ts` beyond AC7; new tests in `statistics.container.spec.ts` limited to closing AC15/AC16 coverage; no existing test in either file weakened, deleted, or rewritten
- [ ] No new dependencies, no `package.json` / `angular.json` edits

## 4. Human-only

No agent ticks anything in this section. The chain stops when only these remain — that is a
correct exit, not a failure.

- [x] Requested by: Oleg
- [x] DoD approved by: <name>, <YYYY-MM-DD>  ← **the gate; nothing past step 2 runs until this is signed**
- [x] Change reviewed and accepted by: <name>
- [ ] Manual browser checks performed (AC8, AC9, AC18) and observations recorded
- [ ] Version bumped in `package.json` if this ships (it is the only user-visible release marker)
