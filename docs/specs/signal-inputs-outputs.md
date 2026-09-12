# Signal-based inputs, outputs, and view queries

## Goal
Replace the last remaining decorator-based component APIs in the codebase — the `@Input()` /
`@Output()` decorators on `ExpensesTableComponent` and the two `@ViewChild()` queries on
`StatisticsContainer` — with the signal-based `input()` / `output()` / `viewChild()` functions,
bringing the code into compliance with the standing rule in `.claude/rules/code-style.md` ("Use
`input()` and `output()` functions instead of decorators") and with Angular v21 practice for
signal queries, as requested by the repo owner.

## Scope

**In:**

*Inputs and outputs*

- `src/shared/components/expenses-table/expenses-table.component.ts` — the only file in `src/` that
  uses `@Input`, `@Output`, or `EventEmitter`. Five inputs (`showDateCol`, `dataSource`, `draggable`,
  `selectable`, `selected`) and three outputs (`deleteRow`, `cellClick`, `selectionChange`),
  at lines 46–74.
- The component's own TS reads of those members: `ngOnChanges` (lines 80–88), `toggleAllRows`
  (line 120), `isAllSelected` (line 131), `defineCols` (lines 134–141), `isColHidden` (line 144).
- `src/shared/components/expenses-table/expenses-table.component.html` — only where the template
  reads a migrated member directly (`[dataSource]="dataSource"` line 1, `[cdkDragDisabled]="!draggable"`
  line 70, and `columns` on lines 64/67 if its derivation changes).
- Removal of `OnChanges` / `SimpleChanges` from the component, since the only `ngOnChanges` body is
  `dataSource` handling.

*View queries*

- `src/modules/dashboard/statistics/statistics.container.ts` — the **only** file in `src/` that uses
  any query decorator. Two `@ViewChild`s, both `private readonly`, both carrying a `read` option:
  - `summaryTable` — `@ViewChild('summaryTable', { read: ElementRef })`, typed
    `ElementRef<HTMLElement>` (lines 26–27). Read only in `tableAnimation()` (lines 74–78), always
    through `?.`.
  - `monthSelector` — `@ViewChild('monthSelector', { read: MatTabGroup })`, typed `MatTabGroup`
    (lines 28–29), declared with a `!` definite-assignment assertion. Read only in
    `scrollToCurrentMonth()` (lines 127–133), unguarded, and that method is called only from
    `ngAfterViewInit` (lines 70–72).
  - The `ViewChild` import on line 2; `ElementRef` and `AfterViewInit` stay (see D6, D8).
- No template change is required for the query migration: `#summaryTable`
  (`statistics.container.html:35`) and `#monthSelector` (`statistics.container.html:24`) keep their
  names and positions.

*Knowledge*

- `knowledge/interfaces/expenses-table-component.md`, `knowledge/flows/statistics.md` (lines 55,
  63–66 for the outputs, lines 77–78 for the view query), `knowledge/flows/delete-expense.md`
  (lines 28, 69), plus one entry in `knowledge/log.md`.

**Out:** (each of these needs its own spec if wanted)

- No behaviour changes visible to a user. Rendering, column selection rules, the swipe-to-delete
  gesture, the drill-down, the month-carousel auto-scroll, the straight/reverse table animation and
  the Total line all behave exactly as they do today. The single intentional semantic delta is
  recorded under **Decisions** (D3) and is a strict widening of when columns recompute.
- No renaming of any input or output. `deleteRow`, `cellClick`, `selectionChange` keep their names,
  so no consumer template binding changes.
- No `model()` adoption — see D2. No new two-way bindings.
- No changes to component selectors, the component hierarchy, or which components import which.
- No changes to NgRx actions, reducers, effects, selectors, or store shape.
- No `@ViewChildren` / `@ContentChild` / `@ContentChildren` / `QueryList` migration — **none found
  in `src/`, so there is nothing to migrate there** (verified: a search of `src/` for
  `ViewChild|ContentChild|QueryList` matches only `statistics.container.ts`; there is no
  `.changes.subscribe(...)`, `.first`, `.toArray()` or `.forEach()` on a query anywhere, and no
  `queries:` metadata in any `@Component`). If one appears later it needs its own spec.
- No replacement of `SelectionModel` with signals, and no conversion of `StatisticsContainer`'s
  remaining plain fields (`sheets`, `currentSheetIndex`, `currentYearIndex`, `currentMonthIndex`,
  `tableReversed`, `selectable`, `selectedCategory`, `total`) or of `DashboardPageContainer` fields
  to signals. No `OnPush` adoption, no removal of the `cd.detectChanges()` calls, no conversion of
  template-driven forms to reactive forms.
- No conversion of `ngAfterViewInit` to an Angular `effect()` — see D8.
- No change to the `canDeactivate` guard in `src/modules/dashboard/dashboard.routes.ts:22-27`, nor to
  the public signature or null-tolerance of `tableAnimation()`, which that guard calls from outside
  the component.
- No replacement of the private Material APIs `MatTabGroup._elementRef` / `._tabHeader` used by
  `scrollToCurrentMonth` — they are copied across verbatim.
- No new tests in `expenses-table.component.spec.ts` beyond what **[AC7]** requires. New tests may be
  added to `statistics.container.spec.ts` to close automated coverage for the view-query behaviour
  (**[AC15]**/**[AC16]**), provided no existing test in either file is weakened, deleted, or rewritten —
  see the corrected **[AC17]**.
- No new dependencies, no `package.json` / `angular.json` edits.

## Approach

Two layers, both presentational: one shared component under `src/shared/components/` and one
container under `src/modules/`. No state (`src/@state/`), service (`src/services/`), or
spreadsheet-layout work is involved, and no remote I/O is touched — so nothing lands in an NgRx
effect. ("Effect" below means the Angular `effect()` from `@angular/core` unless stated otherwise.)

- **Sequence the work as two steps,** each finished with `bash scripts/harness.sh` green before the
  next begins, per the one-task-at-a-time rule in `CLAUDE.md`: (1) the input/output migration in
  `src/shared/components/expenses-table/`, (2) the view-query migration in
  `src/modules/dashboard/statistics/statistics.container.ts`. The two touch disjoint files; the only
  shared surface is `statistics.container.html`, which neither step modifies.
- **Inputs → `input()`.** All five inputs have defaults in code and none is `required`, so each
  becomes `input(<default>)` with an explicit type argument where inference from the default is too
  narrow (`dataSource`, `selected`: `ReadonlyArray<Expense>`). No aliases exist, no
  `@Input({ required: true })` exists, no `transform` is needed. Every TS read becomes a call
  (`this.dataSource()` etc.); the template reads become `dataSource()`, `draggable()`.
- **`selected` loses its setter/getter pair.** Today it is `@Input() set selected(v)` →
  `selection.clear(); selection.select(...v)`, with a getter returning `selection.selected`
  (lines 58–65). It becomes a plain `input()` plus a component `effect()` that pushes the value into
  the `SelectionModel`. The public getter disappears — verified safe: nothing reads
  `component.selected` from TS, and the only binding is `[selected]="expenses"` in
  `src/modules/dashboard/statistics/statistics.container.html:36`.
- **Outputs → `output()`,** except `selectionChange`, which must keep its asynchronous delivery —
  see D1. `deleteRow` and `cellClick` are emitted from DOM event handlers (`cdkDragEnded`,
  `cellClickHandler`), where synchronous delivery is safe.
- **`ngOnChanges` disappears.** Its two responsibilities split: column derivation becomes a
  `computed()` (D3), and the `lastDeletedDragRow.reset()` side effect moves into an `effect()` that
  tracks `dataSource()` only, keeping its truthiness guard and its `_dragRef['_rootElement']` check.
- **View queries → signal queries, one optional and one required.** Both keep their `read` option,
  their names, their `private readonly` visibility and their declared types; only the declaration
  form and the read syntax change (`this.summaryTable?.x` → `this.summaryTable()?.x`,
  `this.monthSelector.x` → `this.monthSelector().x`). `summaryTable` becomes an optional
  `viewChild(...)` (D6); `monthSelector` becomes `viewChild.required(...)` (D7). `ngAfterViewInit`
  and `implements AfterViewInit` stay (D8). Neither member is ever assigned imperatively in the
  class — verified — so there is no write path to rework.
- **Files modified:** the expenses-table `.ts`, the expenses-table `.html` (call-syntax only),
  `statistics.container.ts`, and five knowledge files. **Files created:** none.
- **Knowledge convention.** Concept files describe the system as it is now, in the present tense
  (`knowledge/log.md:3-11`); the change history goes in `knowledge/log.md` only. The concept edits
  must not say "was changed from decorators to signals" — they must simply describe the signal API.

## Decisions

| Question | Alternatives | Choice and reason |
|---|---|---|
| **D1 — `selectionChange` timing.** It is built as `new EventEmitter<...>(true)` (line 74), i.e. *async* mode: Angular defers each emission through a `setTimeout`. `output()` always emits synchronously. | (a) plain `output()`, accept sync delivery; (b) `outputFromObservable()` over `selection.changed` with the emission deferred by one macrotask; (c) plain `output()` plus a manual `setTimeout` around `emit()` | **(b).** Sync delivery is not safe here: `selection.changed` also fires from the `selected` effect during change detection, and the subscriber `StatisticsContainer.onSelection` (`statistics.container.ts:105-108`) mutates `total` and calls `cd.detectChanges()`. `{{ total }}` is rendered *after* `<expenses-table>` in the parent template, so a sync update during the child's refresh risks `NG0100` in dev builds and a re-entrant `detectChanges()`. `outputFromObservable` (`@angular/core/rxjs-interop`, already used in this file for `takeUntilDestroyed`) over `selection.changed` mapped to `selection.selected` and delayed by one macrotask reproduces `EventEmitter(true)` exactly, and its subscription is tied to the component lifetime — so the manual `takeUntilDestroyed()` subscription in the constructor (lines 76–78) is deleted rather than kept. |
| **D2 — `model()` for `selected`.** | (a) `model()`; (b) `input()` + separate `output()` | **(b), keep them separate.** `selected` + `selectionChange` is *not* an Angular two-way pair: two-way binding requires `selected` + `selectedChange`. Adopting `model()` would force renaming the output to `selectedChange`, changing the public template API of the component and collapsing two independently-meaningful signals (what the parent pre-selects vs. what the user has ticked) into one. That is a redesign, not a decorator migration. The only `[(...)]` bindings in the repo are `[(selectedIndex)]` on `mat-tab-group` (`statistics.container.html:5,16,26`) and `[(ngModel)]` in container forms — all Angular/Material APIs, untouched. |
| **D3 — `columns` derivation.** Today `defineCols()` runs only when `dataSource` changes, yet it reads `selectable()` and `showDateCol()` too. | (a) `computed()` over all three signals; (b) keep a mutable field written from a `dataSource`-only effect, reading the other two untracked | **(a) `computed()`.** The derivation is pure. It also removes the documented defect that `ngOnChanges` reads `changes['dataSource'].currentValue` unconditionally and therefore throws if any other input changes alone (`knowledge/interfaces/expenses-table-component.md:56-58`). The delta: columns now also recompute when `selectable` or `showDateCol` flips on its own. Both call sites change `selectable` and `dataSource` in the same turn (`statistics.container.ts:98`, then `aggregator$.next(...)`), so the rendered result is identical; the widening is strictly more correct. Flagged in **Risks**. |
| **D4 — `dataSource` type stays `ReadonlyArray<Expense>`.** | widen to `Expense[]`, or add a `transform` | **Keep as-is.** `<table mat-table [dataSource]="dataSource()">` accepts it today; the migration must not touch typing. If `mat-table`'s signature rejects the call-syntax read, treat it as a type error to solve locally, not by changing the input's type. |
| **D5 — no dependency or config change.** | — | Nothing new is required: `input`, `output`, `computed`, `effect`, `viewChild` come from `@angular/core` and `outputFromObservable` from `@angular/core/rxjs-interop`, both already dependencies. `package.json` and `angular.json` are untouched, consistent with `policy/sprint-window.json`. **No human decision needed.** |
| **D6 — `summaryTable`: optional or required?** It is declared without `!`, and every read already uses `?.`. | (a) `viewChild('summaryTable', { read: ElementRef })` — optional signal; (b) `viewChild.required(...)`, dropping the `?.` | **(a), optional, and the `?.` stays.** Two independent reasons. First, `<expenses-table #summaryTable>` sits inside an `@if` block (`statistics.container.html:33-42`), so its presence is structurally conditional even though the condition `(expenses$ \| async) \|\| []` happens to be always truthy today. Second, and decisively, `tableAnimation('none')` runs from the **constructor** path — the `sheetsSelector` subscription calls `formChanged` (line 66), which calls `tableAnimation` (line 81) — long before any view exists; `viewChild.required()` would throw `NG0951` there. The `read: ElementRef` option must be kept: `#summaryTable` is on a *component* element, so without it the query would resolve to the `ExpensesTableComponent` instance rather than its host `ElementRef`. |
| **D7 — `monthSelector`: optional or required?** Declared `!` and dereferenced without a guard. | (a) `viewChild.required('monthSelector', { read: MatTabGroup })`; (b) plain `viewChild()` plus `?.` everywhere in `scrollToCurrentMonth` | **(a) `viewChild.required`.** The `<mat-tab-group #monthSelector>` is unconditional (`statistics.container.html:23-30`) and the current code already asserts it is always there via `!`; `.required()` is the faithful translation. Option (b) would convert today's loud failure (a `TypeError` if the ref ever disappeared) into a silent no-op — the month carousel would simply stop auto-scrolling with no signal to anyone. Keep `read: MatTabGroup` rather than switching to the class-locator form `viewChild.required(MatTabGroup)`: the locator form would match the **first** `mat-tab-group` in the template, which is the *user* carousel (line 3), not the month one. That would be a silent behaviour change. |
| **D8 — keep `ngAfterViewInit`, or move `scrollToCurrentMonth` into an `effect()`?** Signal queries are readable from construction and no longer depend on the lifecycle hook for timing. | (a) keep `implements AfterViewInit` / `ngAfterViewInit`; (b) replace it with an `effect()` tracking `monthSelector()` | **(a) keep it.** View queries are resolved before `ngAfterViewInit` runs, so a `.required()` read there stays valid. The body is a one-shot DOM measurement (`getBoundingClientRect()`) plus a `setTimeout` write into Material internals — imperative, non-reactive, and intended to happen exactly once. An `effect()` would wrap imperative DOM work in a reactive context and would re-run if the query signal ever changed identity, scrolling the carousel again at an unexpected moment. Constraint for the implementer: do **not** move this call into the constructor or `ngOnInit`, where the required query is not yet resolved. |
| **D9 — `@ViewChildren` / `@ContentChild` / `@ContentChildren` / `QueryList`.** | — | **Nothing to do: none exist in `src/`.** Verified by searching `src/` for `ViewChild\|ContentChild\|QueryList` (only `statistics.container.ts` matches, with the two `@ViewChild`s above) and for `queries:` component metadata (no matches). There is therefore no `QueryList`-specific consumer to re-express — no `.changes.subscribe(...)`, `.first`, `.toArray()` or `.forEach()` — and no need for an `effect()`/`computed()` bridge over a `viewChildren()` array signal. Recorded here so the implementer does not go looking. |

## Risks

- **Highest blast radius: the statistics Total line.** It depends on `selectionChange` timing.
  Getting D1 wrong yields either a dev-mode `ExpressionChangedAfterItHasBeenCheckedError` or a Total
  that silently stops updating. This must be exercised in the browser, not only by the harness.
- **Initial selection timing.** The old setter ran as part of input propagation, before the child's
  template was checked; a component `effect()` runs as part of the component's own refresh. If the
  checkboxes on `<expenses-table [selected]="expenses">` render unchecked for a frame, or the Total
  starts at 0 and corrects itself, the effect is running too late — that is the signal to revisit.
- **Swipe-to-delete reset.** `lastDeletedDragRow.reset()` moving from `ngOnChanges` to an `effect()`
  changes when the flung row's transform is cleared relative to render. The symptom of getting it
  wrong is a recycled DOM row rendering off-screen after a delete
  (`knowledge/flows/delete-expense.md:69`). Verify by deleting a row on the dashboard and confirming
  the list redraws normally.
- **`SelectionModel` mutation loops.** The `selected` effect writes into the model, the model's
  `changed` stream feeds `selectionChange`, and the parent reacts. Confirm no feedback loop: the
  parent's `onSelection` must not write back into the `selected` binding (today it only sets `total`).
- **`dataSource` is read in two hot paths** (`toggleAllRows`, `isAllSelected`). Missing a `()` there
  is a type error, but reading the *signal object* where a length was expected inside a template
  expression can silently produce `undefined` — lint and typecheck should catch it; a quick manual
  check of the "select all" checkbox's indeterminate state is cheap insurance.
- **`NG0951` from the required query is the main new failure mode.** `monthSelector()` throws if read
  before the view is created. Today's only read site is safe (D8), but `tableAnimation` — which sits
  three lines away and *is* reachable from the constructor — is not; mixing the two up, or "tidying"
  `summaryTable` into `.required()` to drop the `?.`, produces a container that crashes on entry to
  the Statistics route. If `statistics.container.spec.ts` starts failing on `detectChanges()` with
  `NG0951`, D7 is wrong for the test environment and must be revisited rather than patched with a
  try/catch.
- **Silently querying the wrong element.** Both queries carry a `read` option that changes what they
  resolve to. Dropping `read: ElementRef` yields a component instance with no `nativeElement`
  (a type error, caught); switching `monthSelector` to a class locator yields the *wrong*
  `mat-tab-group` (not a type error, not caught by any test — see D7). Keep the string locator plus
  `read` in both cases.
- **`tableAnimation` is called across a boundary.** The route's `canDeactivate`
  (`src/modules/dashboard/dashboard.routes.ts:22-27`) calls `component.tableAnimation('none')` on a
  component that is being torn down. It must stay `public` and must stay tolerant of a missing
  element; a destroyed-view read of an optional `viewChild` returning `undefined` is exactly what the
  `?.` absorbs. Losing that is a navigation-time crash, not a cosmetic bug.
- **Private Material internals.** `scrollToCurrentMonth` reads `_elementRef` and writes
  `_tabHeader.scrollDistance`. The migration copies these verbatim; if a typecheck error appears
  there, it is a Material typing issue, not a signal-query issue, and is out of scope.
- **Not touched, and must stay that way:** the sheet column layout, row-index arithmetic, and date
  conversion. This change never reaches `src/services/spreadsheet/` or `src/@state/`, so no data a
  user already has in their spreadsheet is at risk. If an implementer finds themselves editing
  either, they have left the scope of this spec.
- **`withComponentInputBinding()` is enabled** (`src/app/app.config.ts:50`), but no component in
  `src/` binds a route param to an input, so route-to-input binding is unaffected.

## Acceptance criteria

- **[AC1]** `bash scripts/harness.sh` is green — all four layers (lint, typecheck, build, test).
- **[AC2]** A search of `src/` for `@Input(`, `@Output(`, and `EventEmitter` returns no matches in
  application code. `ExpensesTableComponent` no longer imports `Input`, `Output`, `EventEmitter`,
  `OnChanges`, or `SimpleChanges` from `@angular/core`, and no longer declares
  `implements OnChanges` or an `ngOnChanges` method.
- **[AC3]** `ExpensesTableComponent` exposes exactly five inputs — `showDateCol`, `dataSource`,
  `draggable`, `selectable`, `selected` — declared with `input()`, with the same defaults as today
  (`true`, `[]`, `false`, `false`, `[]` respectively), the same names (no aliases), and none of them
  required.
- **[AC4]** `ExpensesTableComponent` exposes exactly three outputs with unchanged names and payload
  types: `deleteRow: Expense`, `cellClick: { field: keyof Expense; cellData: unknown; rowData: Expense }`,
  `selectionChange: ReadonlyArray<Expense>`. `deleteRow` and `cellClick` are declared with `output()`;
  `selectionChange` is declared with `outputFromObservable()` per D1 and its emission is deferred by
  one macrotask.
- **[AC5]** Neither consumer template changes its bindings: `statistics.container.html:34-41` still
  binds `[selected] [selectable] [dataSource] (cellClick) (selectionChange)`, and
  `dashboard-page.container.html:78-84` still binds `[dataSource] [showDateCol] [draggable] (deleteRow)`.
  `dashboard-page.container.ts` is not modified at all, and the only edits to
  `statistics.container.ts` are the view-query ones required by [AC14]–[AC16] — nothing in that file
  changes on account of the input/output migration.
- **[AC6]** `columns` is a `computed()` derived from `dataSource()`, `selectable()`, and
  `showDateCol()`, preserving the existing rules: `select` first when `selectable`, then each of
  `['date','category','amount','comment','isInDebt']` kept only if some row has a defined value for
  it and it is not the date column while `showDateCol` is false.
- **[AC7]** `expenses-table.component.spec.ts` still passes **unmodified**. Additionally the spec
  gains at least two tests using `fixture.componentRef.setInput(...)`: one asserting the rendered
  header columns for an aggregate row set (`category` + `amount` only) versus a full row set, and one
  asserting that setting `selected` marks those rows selected. Existing tests are not deleted or
  weakened.
- **[AC8]** Manual browser check (two-terminal loop, `http://localhost:4200/exp-spsh/`): on
  Statistics, all rows render pre-checked on first paint and the Total equals the sum; unticking a
  category lowers the Total; clicking a category drills down and the undo button restores the
  grouped view with the checkbox column back.
- **[AC9]** Manual browser check: on the Dashboard, swiping a row past the delete threshold still
  deletes it, the date column stays hidden, and no row renders off-screen after the list refreshes.
- **[AC10]** `knowledge/interfaces/expenses-table-component.md` describes the signal API in the
  present tense: inputs as `InputSignal`s read with `()`, the three outputs under their **real**
  names (the current file lists them as `onDeleteRow`, `onCellClick`, `onSelection` at lines 36–38,
  which never matched the code), `selected` as an input whose value is applied to the `SelectionModel`
  by an effect rather than a setter, `columns` as a `computed()`, and the `ngOnChanges`-throws note
  at lines 56–58 removed because the condition no longer exists.
- **[AC11]** `knowledge/flows/statistics.md` (lines 55 and 63–66) and
  `knowledge/flows/delete-expense.md` (lines 28 and 69) use the real output names `cellClick`,
  `selectionChange`, `deleteRow`, and no longer attribute the flung-row reset to `ngOnChanges`.
- **[AC12]** `knowledge/log.md` gains one dated entry at the top describing this migration — both the
  input/output half and the view-query half — and naming every concept file touched. No concept file
  narrates the change itself; that history lives only in the log.
- **[AC13]** No file outside `src/shared/components/expenses-table/`,
  `src/modules/dashboard/statistics/`, `knowledge/`, and `docs/` is modified. In particular
  `src/modules/dashboard/dashboard.routes.ts` and `statistics.container.html` are byte-identical
  afterwards, and `package.json`, `angular.json`, and `eslint.config.js` are untouched with no
  `eslint-disable` comment added.
- **[AC14]** A search of `src/` for `@ViewChild`, `@ViewChildren`, `@ContentChild`, and
  `@ContentChildren` returns no matches, and no file imports `QueryList`. `statistics.container.ts`
  no longer imports `ViewChild` from `@angular/core`; it still imports `ElementRef` (used as a `read`
  token) and `AfterViewInit`.
- **[AC15]** `summaryTable` is a `private readonly` **optional** `viewChild` located by the string
  `'summaryTable'` with `{ read: ElementRef }`, typed so that the signal yields
  `ElementRef<HTMLElement> | undefined`. `tableAnimation(direction)` keeps its `public` modifier and
  its exact signature, reads the query as `this.summaryTable()?.nativeElement`, still removes both
  `summary-table-reverse` and `summary-table-straight` before the `direction === 'none'` early
  return, and still adds `summary-table-${direction}` otherwise. Calling it before the view exists
  (the constructor → `formChanged` path, line 66 → line 81) is a no-op, not a throw.
- **[AC16]** `monthSelector` is a `private readonly` `viewChild.required` located by the string
  `'monthSelector'` with `{ read: MatTabGroup }` — not the `viewChild.required(MatTabGroup)` class
  locator (D7). `scrollToCurrentMonth()` is unchanged apart from the call syntax: same
  `getBoundingClientRect()` read via `_elementRef.nativeElement`, same `PADDINGS` subtraction, same
  `width < currentMonthIndex * MONTH_BUTTON_WIDTH` condition, same `setTimeout` write to
  `_tabHeader.scrollDistance`. The class still declares `implements AfterViewInit`, and
  `ngAfterViewInit` remains the only caller of `scrollToCurrentMonth`.
- **[AC17]** `statistics.container.spec.ts`'s original `should create` test is not weakened, deleted,
  or rewritten, and the whole file still passes — in particular the existing `fixture.detectChanges()`
  in `beforeEach` runs `ngAfterViewInit` without throwing `NG0951`. New tests may be added to this
  file to close automated coverage for **[AC15]**/**[AC16]** (the view-query behaviour), since no
  other spec file exercises `StatisticsContainer`.
- **[AC18]** Manual browser check (two-terminal loop): entering Statistics with a late month selected
  (e.g. December) still auto-scrolls the month carousel so the current month is visible; drilling into
  a category still plays the `straight` animation and undo still plays `reverse`; navigating away from
  Statistics and back leaves no stale `summary-table-*` class on the table; the user/year carousels
  still switch data (i.e. `monthSelector` did not silently bind to the wrong `mat-tab-group`).
- **[AC19]** `knowledge/flows/statistics.md` lines 77–78 describe the current state in the present
  tense: `summaryTable` as an optional signal view query read with `()` and `?.` because the table
  sits inside an `@if` and because `tableAnimation` can run before the view exists, and
  `monthSelector` as a required signal view query read in `ngAfterViewInit`. The statement in
  `knowledge/architecture/routing-and-guards.md:49-51` about the `canDeactivate` guard remains
  accurate and is left unedited.
