# Review — Signal-based inputs, outputs, and view queries (`signal-inputs-outputs`)

Spec: `docs/specs/signal-inputs-outputs.md`
DoD: `docs/dod/signal-inputs-outputs.md`
Reviewed: 2026-09-11

## Verdict

**request changes** — all findings are **minor**; nothing here is critical, nothing blocks, and
nothing in the change set touches the sheet column layout, row-index arithmetic, date conversion,
or `policy/sprint-window.json`-denied files.

The migration itself is faithful. Every one of D1–D9 was followed as written, including the three
the task called out as most at risk (D1 macrotask deferral, D6 optional `summaryTable`, D7 string
locator + `read: MatTabGroup`, D8 `ngAfterViewInit` retained). The harness is green on my own run.
Seventeen of the nineteen ACs are met without qualification.

Changes are requested for two ACs that are **literally** not met as worded, plus three
documentation-accuracy defects that this repo's own conventions treat as real:

- **AC4** — `selectionChange`'s declared payload type is now `Expense[]`, not
  `ReadonlyArray<Expense>` (F1). One type argument fixes it; leaving it also makes the brand-new
  knowledge file wrong on its first line of the Outputs table.
- **AC13** — two new `eslint-disable-next-line` comments were added (F5). They follow the house
  pattern (inline, with a reason), but AC13 says "no `eslint-disable` comment added", so the
  orchestrator cannot tick it without an owner decision like the AC17 amendment.
- F2 (a required view query re-read inside a `setTimeout`), F3 (three comments in the new tests
  describing code that no longer exists), F4 (`knowledge/operations/testing.md` now misstates
  coverage for both touched spec files).

None of these needs a re-plan. All are local edits inside files this spec already owns.

## Spec compliance

| AC | Status | Evidence |
|---|---|---|
| **AC1** — harness green, all four layers | check | My own run of `bash scripts/harness.sh`: `lint: passed / typecheck: passed / build: passed / test: passed`, `harness: green`. 12 test files passed, 1 skipped; 99 tests passed, 2 skipped. See **Harness** below. |
| **AC2** — no `@Input(`/`@Output(`/`EventEmitter` in `src/`; no `OnChanges`/`SimpleChanges` | check | `grep -rn "@Input(\|@Output(\|EventEmitter\|SimpleChanges\|ngOnChanges" src/` returns only three **comment** lines in `src/shared/components/expenses-table/expenses-table.component.spec.ts:13,14,263` — no code matches. `expenses-table.component.ts:4-5` imports only `ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, input, output` + `outputFromObservable`. Class declaration at `:24` is bare (`export class ExpensesTableComponent {`). Those comment lines are F3. |
| **AC3** — exactly five `input()`s, same names/defaults, none required | check | `expenses-table.component.ts:36-40`: `showDateCol = input(true)`, `dataSource = input<ReadonlyArray<Expense>>([])`, `draggable = input(false)`, `selectable = input(false)`, `selected = input<ReadonlyArray<Expense>>([])`. No aliases, no `input.required`. Exercised by `expenses-table.component.spec.ts::should_render_date_column_when_showDateCol_is_true`, `::should_hide_date_column_when_showDateCol_is_false`, `::should_disable_drag_by_default`, `::should_enable_drag_when_draggable_is_true`, `::should_hide_select_column_by_default`, `::should_show_select_column_when_selectable_is_true`. |
| **AC4** — exactly three outputs, unchanged names and payload types; `selectionChange` via `outputFromObservable`, deferred one macrotask | **cross (minor)** | Names, count and mechanism are right: `:42-49` — `deleteRow = output<Expense>()`, `cellClick = output<{...}>()`, `selectionChange = outputFromObservable(this.selection.changed.pipe(map(() => this.selection.selected), delay(0)))`. The one-macrotask deferral is *asserted*, not just inspected: `expenses-table.component.spec.ts::should_emit_selectionChange_with_updated_selection_after_row_toggle` checks `emitted.length === 0` synchronously after the checkbox `change`, then `=== 1` after a `setTimeout` flush. **But** the payload type is `Expense[]`, not `ReadonlyArray<Expense>` — `SelectionModel.selected` is declared `T[]` (`node_modules/@angular/cdk/types/_selection-model-chunk.d.ts:19`) and no explicit type argument was given to `outputFromObservable`. See **F1**. |
| **AC5** — consumer templates unchanged; `dashboard-page.container.ts` untouched; `statistics.container.ts` edits are view-query-only | check | `git status --porcelain` lists neither `statistics.container.html`, `dashboard-page.container.html`, nor `dashboard-page.container.ts` as modified. Bindings verified in place: `statistics.container.html:35-41` (`[selected] [selectable] [dataSource] (cellClick) (selectionChange)`), `dashboard/dashboard-page.container.html:78-83` (`[dataSource] [showDateCol] [draggable] (deleteRow)`). The `statistics.container.ts` diff is four hunks, all query declarations/read syntax (`:26-27`, `:73`, `:75`, `:126`, `:129`). |
| **AC6** — `columns` is a `computed()` over the three signals, rules preserved | check | `expenses-table.component.ts:51-59`: `select` pushed first when `selectable()`, then `DEFAULT_COLS.filter(hasData && !isColHidden)`. Covered by `expenses-table.component.spec.ts::should_render_only_columns_with_data_for_aggregate_rows` (expects exactly `['category','amount']`), `::should_render_all_default_columns_for_full_rows` (expects all five in order), `::should_show_select_column_when_selectable_is_true` (`select` first). Two caveats, both minor: the D3 *widening* is not itself asserted anywhere (F3), and the computed's tracking of `showDateCol()` is data-dependent (N1). |
| **AC7** — original spec passes; ≥2 new `setInput` tests (aggregate vs full columns, `selected` marks rows) | check | Original file at `HEAD` contained exactly one test (`should create`); it is present and byte-identical at `expenses-table.component.spec.ts:71-73`. The two required tests exist and use `fixture.componentRef.setInput`: `::should_render_only_columns_with_data_for_aggregate_rows` / `::should_render_all_default_columns_for_full_rows` and `::should_mark_provided_rows_as_selected_in_rendered_checkboxes`. 17 tests in the file, all green (`npx ng test --watch=false --include ...`: 23 tests across the two files, all passed). The file *is* modified, so read AC7's "unmodified" as its evident intent (nothing deleted or weakened) — that intent holds. See N5 on the count. |
| **AC8** — manual browser check (Statistics) | N/A | Human-only. I cannot and did not perform it. Section 4 of the DoD. |
| **AC9** — manual browser check (Dashboard swipe-delete) | N/A | Human-only. |
| **AC10** — `knowledge/interfaces/expenses-table-component.md` describes the signal API, real output names, stale `ngOnChanges`-throws note removed | check (with F1) | `:24` "All five are `input()` signals"; `:28-32` types as `InputSignal<…>` with correct defaults; `:32` describes the `effect()` applying `selected` to the `SelectionModel`; `:38-40` names `deleteRow`/`cellClick`/`selectionChange`; `:42-48` explains the `outputFromObservable` + `delay(0)` deferral and its NG0100 rationale; `:55-66` describes `columns` as a `computed()` and states the D3 widening; the old `ngOnChanges`-throws blockquote is gone. Verified line-by-line against the current source, not just for internal consistency. One inaccuracy: `:40` documents the payload as `ReadonlyArray<Expense>` while the code now emits `Expense[]` (F1). |
| **AC11** — `statistics.md` / `delete-expense.md` use real output names, drop the `ngOnChanges` attribution | check | `knowledge/flows/statistics.md:55` `cellClick`, `:64` `selectionChange`; `knowledge/flows/delete-expense.md:28` `deleteRow`, `:69` "a component `effect()` tracking `dataSource()` calls `lastDeletedDragRow.reset()`". A bundle-wide grep for `onDeleteRow|onCellClick|onSelection|ngOnChanges|@ViewChild|@Input|@Output|defineCols` across `knowledge/` and `docs/` (excluding this spec/DoD and the log) returns **zero** stale references. |
| **AC12** — one dated `knowledge/log.md` entry naming every concept file touched; no concept file narrates the change | check | `knowledge/log.md:3-11` — `## 2026-09-11 (3)`, at the top, covering both halves and naming all three concept files (`interfaces/expenses-table-component.md`, `flows/statistics.md`, `flows/delete-expense.md`), matching the format of the two entries below it. No concept file contains "was changed"/"used to"/"previously" prose; the closest is `expenses-table-component.md:45`'s reference to `EventEmitter(true)` *semantics*, which reads as present-tense rationale for the `delay(0)`, not as history. Acceptable. |
| **AC13** — nothing modified outside the four permitted trees; `dashboard.routes.ts` / `statistics.container.html` byte-identical; `package.json` / `angular.json` / `eslint.config.js` untouched; no `eslint-disable` added | **cross (minor)** | Paths: `git status --porcelain` shows only the two `src/` trees, `knowledge/`, and `docs/` — plus `.claude/agents/implementer.md`, which is **unrelated and predates this work** (it was already `M` in the session-start status; its diff is a one-line agent-prompt reword). See N4. `dashboard.routes.ts`, `statistics.container.html`, `package.json`, `angular.json`, `eslint.config.js` are all absent from the modified list — the write policy is respected. The failing clause is the last one: two new `eslint-disable-next-line` comments at `statistics.container.spec.ts:44` and `:51`. See **F5**. |
| **AC14** — no query decorators or `QueryList` in `src/`; `statistics.container.ts` drops `ViewChild`, keeps `ElementRef` + `AfterViewInit` | check | `grep -rn "@ViewChild\|@ContentChild\|QueryList" src/` → no matches. `statistics.container.ts:2` imports `AfterViewInit, ChangeDetectorRef, Component, ElementRef, viewChild`; `:25` still `implements AfterViewInit`. |
| **AC15** — `summaryTable` optional, string locator + `read: ElementRef`, `ElementRef<HTMLElement> \| undefined`; `tableAnimation` public, same signature and class toggling; no-op before the view exists | check | `statistics.container.ts:26`: `private readonly summaryTable = viewChild<unknown, ElementRef<HTMLElement>>('summaryTable', { read: ElementRef })` — the explicit `ReadT` argument preserves the `HTMLElement` type parameter that a bare call would have widened to `any`. `:72-76`: `public tableAnimation(direction: 'reverse' \| 'straight' \| 'none')`, both reads via `this.summaryTable()?.nativeElement`, remove-both-then-early-return-on-`'none'` order intact. Covered by `statistics.container.spec.ts::should_add_summary_table_straight_class_and_remove_reverse_when_direction_is_straight`, `::should_add_summary_table_reverse_class_and_remove_straight_when_direction_is_reverse`, `::should_remove_both_animation_classes_and_add_none_when_direction_is_none`, and — for the constructor path — `::should_not_throw_when_summaryTable_query_has_not_resolved_yet`, which constructs a fixture whose `detectChanges()` has never run and asserts `tableAnimation('straight')` does not throw. I additionally confirmed in the Angular source that an optional query on a **destroyed** view returns `undefined` rather than a stale ref (`node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:9532-9537`), so the `canDeactivate` teardown call at `dashboard.routes.ts:22-27` is safe — marginally safer than before, when the field held a detached `ElementRef`. |
| **AC16** — `monthSelector` is `viewChild.required('monthSelector', { read: MatTabGroup })` (string locator, not class locator); `scrollToCurrentMonth` unchanged apart from call syntax | check | `statistics.container.ts:27` — string locator with `read`, exactly as D7 requires; no `viewChild.required(MatTabGroup)` anywhere. `:125-131` keeps the same `getBoundingClientRect()` read through `_elementRef.nativeElement`, the same `width -= PADDINGS`, the same `width < currentMonthIndex * MONTH_BUTTON_WIDTH` test, and the same `setTimeout` write to `_tabHeader.scrollDistance`. `ngAfterViewInit` (`:68-70`) remains the sole caller. The "silently bound to the wrong `mat-tab-group`" risk — the one the spec says no test would catch — **is** now caught: `statistics.container.spec.ts::should_scroll_month_tab_header_for_a_late_month_index_without_throwing_NG0951` spies on the `scrollDistance` setter of the tab group found via `.carousel-selector-month` and asserts it was called with `-76`, which can only happen if the query resolved to the month carousel and not the user carousel at `statistics.container.html:3`. That is the single most valuable test in this change set. See **F2** for the one behavioural wrinkle in this method. |
| **AC17** — original `should create` not weakened/deleted/rewritten; file passes; `detectChanges()` in `beforeEach` runs `ngAfterViewInit` without NG0951; new AC15/AC16 tests permitted | check | I verified the current wording of AC17 and the spec's Out list (`docs/specs/signal-inputs-outputs.md:78-81`, `:260-264`) reflects the amendment; treated as authoritative and not flagged. `should create` at `statistics.container.spec.ts:95-97` is byte-identical to `HEAD`. The `beforeEach` *was* extended (store seeding + a `document.startViewTransition` stub) — this **strengthens** rather than weakens it: `src/@state/app.reducers.ts:18-29` hydrates `initialState.dataSheets` from real `localStorage` at module load, so before the seeding the original test's outcome depended on whatever the headless browser happened to have stored; with an empty store the constructor path `:63-64` → `formChanged` → `sheets[-1].id` throws out of `createComponent`. Six tests in the file, all green, no NG0951. |
| **AC18** — manual browser check (carousel scroll, animations, stale classes, carousels still switch data) | N/A | Human-only. Worth noting the automated coverage above narrows what the human still has to look for — but AC18 remains unticked by any agent. |
| **AC19** — `statistics.md` describes both queries in present tense; `routing-and-guards.md:49-51` unedited | check | `knowledge/flows/statistics.md:77-82` describes `summaryTable` as an optional `viewChild(...)` read with `()?.` and gives both reasons (inside an `@if`; `tableAnimation` reachable from the constructor via `formChanged`), and `monthSelector` as `viewChild.required(...)` read only from `scrollToCurrentMonth()` via `ngAfterViewInit`. Every clause checks out against `statistics.container.ts` and `statistics.container.html:33-42`. `knowledge/architecture/routing-and-guards.md` is not in the modified-file list. |

### Decisions D1–D9

| D | Followed? | Note |
|---|---|---|
| **D1** — `selectionChange` stays macrotask-deferred | **yes** | `outputFromObservable` over `selection.changed`, `map(() => selection.selected)`, `delay(0)`. `delay(0)` schedules on `asyncScheduler` (zone-patched timer) — a macrotask, matching `EventEmitter(true)`'s `setTimeout`, and the value is snapshotted synchronously at source-emission time exactly as `emit(this.selection.selected)` did. The manual `takeUntilDestroyed()` constructor subscription was deleted, as D1 required; lifetime is now handled by `outputFromObservable`'s own `DestroyRef` wiring. Type caveat: F1. |
| **D2** — no `model()` | yes | `selected` is a plain `input()`; the output is still `selectionChange`, not `selectedChange`. No new `[(...)]` bindings. |
| **D3** — `columns` as `computed()` | yes | `:51-59`. The widening is documented in `knowledge/interfaces/expenses-table-component.md:64-66`. Untested (F3), and see N1. |
| **D4** — `dataSource` stays `ReadonlyArray<Expense>` | yes | `:37`; `[dataSource]="dataSource()"` compiles against `mat-table` with no cast and no local type workaround. |
| **D5** — no dependency/config change | yes | Only new imports are `delay, map` from `rxjs` and `outputFromObservable` from `@angular/core/rxjs-interop` — both existing dependencies. `package.json` / `angular.json` untouched, so the sprint write policy is not engaged. |
| **D6** — `summaryTable` optional, `?.` kept, `read: ElementRef` kept | **yes** | `:26`, `:73`, `:75`. Not "tidied" into `.required()` — the exact mistake the Risks section warned about was avoided, and there is now a test pinning it. |
| **D7** — string locator + `read: MatTabGroup`, not the class locator | **yes** | `:27`. Confirmed by grep that no class-locator form exists, and behaviourally by the month-carousel scroll test. |
| **D8** — keep `ngAfterViewInit`, no `effect()` | **yes** | `:25` (`implements AfterViewInit`), `:68-70`. `scrollToCurrentMonth` was not moved to the constructor or `ngOnInit`, and no `effect()` was introduced in this container. |
| **D9** — nothing to migrate | yes | Re-verified: `grep -rn "@ViewChild\|@ContentChild\|QueryList" src/` → no matches. |

## Harness

`bash scripts/harness.sh`, run by me on the working tree as reviewed:

```
=== harness summary ===
  lint:      passed
  typecheck: passed
  build:     passed
  test:      passed
harness: green
```

Test layer: **12 test files passed, 1 skipped; 99 tests passed, 2 skipped**, 3.75 s.

No new skips: `grep -rn "describe.skip\|it.skip\|xdescribe\|xit(" src/` matches exactly one file,
`src/app/app.component.spec.ts:7`, which is untouched by this change set and accounts for both
skipped tests.

I also ran the two touched specs in isolation:
`npx ng test --watch=false --include src/shared/components/expenses-table/expenses-table.component.spec.ts --include src/modules/dashboard/statistics/statistics.container.spec.ts`
→ **2 files, 23 tests, all passed** (17 expenses-table + 6 statistics).

## Findings

### F1 — `selectionChange` now emits a *mutable* `Expense[]`, and it is the `SelectionModel`'s own internal array

- **Severity:** minor
- **Location:** `src/shared/components/expenses-table/expenses-table.component.ts:44-49`;
  documented contradiction at `knowledge/interfaces/expenses-table-component.md:40`
- **What's wrong:** `outputFromObservable` was called without a type argument, so the output's
  payload type is inferred from `SelectionModel.selected`, which is declared `T[]`
  (`node_modules/@angular/cdk/types/_selection-model-chunk.d.ts:19`). The old
  `EventEmitter<ReadonlyArray<Expense>>(true)` declared it read-only. AC4 requires "unchanged
  payload types", and the knowledge file written in this same change set still says
  `ReadonlyArray<Expense>`.
- **Why it matters:** the array handed to subscribers is not a copy — CDK memoises it
  (`get selected() { if (!this._selected) { this._selected = Array.from(...) } return this._selected }`),
  so a consumer can now legally `push`/`splice` straight into the component's live selection state
  and the compiler will not stop them. Today's single consumer (`StatisticsContainer.onSelection`,
  `statistics.container.ts:103-106`) only reduces over it, so there is no live bug — this is a
  guard-rail that the migration silently removed, plus a code/doc mismatch in a file the repo has
  just finished sweeping for accuracy.
- **Suggested direction:** restore the declared contract by giving `outputFromObservable` the
  explicit payload type it used to have (the source observable is already assignable to it), so
  code, AC4, and the knowledge table agree again. Do not "fix" it by editing the knowledge file to
  say `Expense[]` — that documents the weaker contract rather than the intended one.

### F2 — `scrollToCurrentMonth` re-reads a *required* view query inside its `setTimeout`

- **Severity:** minor
- **Location:** `src/modules/dashboard/statistics/statistics.container.ts:129`
- **What's wrong:** the deferred write is `setTimeout(() => (this.monthSelector()._tabHeader.scrollDistance = width))`.
  The query is read a second time, *inside the timer callback*, rather than through a value captured
  at `:126`. Angular's `refreshSignalQuery` returns `undefined` once the view's LView carries the
  destroyed flag (`node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:9532-9537`), and
  `createQuerySignalFn` throws `NG0951` when a **required** query yields `undefined` (`:9497-9503`).
- **Why it matters:** pre-migration the field held the `MatTabGroup` reference, so if the container
  was torn down between `ngAfterViewInit` and the 0 ms timer the write was a harmless assignment on
  a detached object. Now that same sequence throws inside a timer callback, where nothing catches it
  — it surfaces as an uncaught error, not as one of this repo's `catchError → log → EMPTY` paths.
  The window is genuinely narrow (destruction within one macrotask of view init: a fast route
  bounce off Statistics, or a test that creates a fixture and tears it down without flushing), which
  is why this is minor and not major. It is a new failure mode introduced by the migration, though,
  not a pre-existing one.
- **Suggested direction:** read the query once at the top of the method into a local and let the
  timer close over that local (or over `_tabHeader` directly). That also matches D8's own framing of
  this body as a one-shot imperative measurement rather than something that should re-resolve later.

### F3 — three comments in the new expenses-table tests describe code that no longer exists, and the D3 widening is asserted nowhere

- **Severity:** minor
- **Location:** `src/shared/components/expenses-table/expenses-table.component.spec.ts:8-16`,
  `:86-88`, `:263`
- **What's wrong:** these tests were written as a pre-migration baseline and their comments were not
  retargeted. `:13-14` explains the macrotask flush in terms of "`EventEmitter`'s async
  (`isAsync: true`) delivery … `@angular/core`'s `EventEmitter_.wrapInTimeout`"; `:263` says
  "deferred by one macrotask (`EventEmitter(true)`)"; `:86-88` justifies input ordering with "so the
  current implementation's dataSource-gated `defineCols()` reads the updated value in the same
  recompute". There is no `EventEmitter` and no `defineCols` in the component any more — the
  mechanisms are `outputFromObservable(... delay(0))` and a `computed()`.
- **Why it matters:** two costs. First, a reader who greps for `defineCols` or `wrapInTimeout` to
  understand the test finds nothing, and may conclude the test is stale rather than the comment.
  Second, `:86-88` encodes a *constraint that D3 deliberately removed* — setting `showDateCol`
  before `dataSource` is no longer necessary. Because every column test follows that ordering, the
  one semantic delta this spec intentionally introduced (columns recompute when `selectable` or
  `showDateCol` flips alone) has no test at all, even though the knowledge base now asserts it
  (`knowledge/interfaces/expenses-table-component.md:64-66`).
- **Suggested direction:** retarget the three comments to the actual mechanisms, and consider one
  additional case that sets `showDateCol` (or `selectable`) *after* `dataSource` with no second
  `dataSource` write, asserting the header set changes. That is the cheapest possible pin on D3 and
  would let a future reader trust the knowledge claim.

### F4 — `knowledge/operations/testing.md` now understates the coverage this change added

- **Severity:** minor
- **Location:** `knowledge/operations/testing.md:81-82` (and the summary paragraph at `:87-93`)
- **What's wrong:** both rows still read "active, 1 test — creation smoke test". The expenses-table
  spec now has 17 tests covering every input, all three outputs and the column rules; the statistics
  container spec now has 6, including the only automated coverage of the view queries.
- **Why it matters:** `CLAUDE.md` requires `knowledge/` to be updated when behaviour or coverage
  changes, and the log entry directly above this change (`knowledge/log.md:13-40`) records a
  bundle-wide sweep whose entire purpose was removing exactly this class of staleness. Leaving it
  means the next agent reads "the meaningful coverage is the expense equality helper, `toMessage`,
  the Sheets service and the failure-reporting mechanism" and re-derives tests that already exist —
  or, worse, treats the table component as untested when deciding how risky a change is.
- **Suggested direction:** update the two rows and the "what is actually covered" paragraph, and
  extend the existing `## 2026-09-11 (3)` log entry to name `operations/testing.md` among the files
  touched (AC12 requires the log entry to name every concept file touched, so this has to be done
  together).

### F5 — two new `eslint-disable-next-line` comments, against AC13's wording

- **Severity:** minor
- **Location:** `src/modules/dashboard/statistics/statistics.container.spec.ts:44`
  (`@typescript-eslint/no-empty-function`) and `:51` (`@typescript-eslint/no-explicit-any`)
- **What's wrong:** AC13 ends "…and `eslint.config.js` [is] untouched with no `eslint-disable`
  comment added". Two were added. Both carry a reason, which is the pattern `CLAUDE.md` prescribes,
  and the `no-empty-function` one mirrors an identical disable already present in the production
  file (`statistics.container.ts:179`) — so this is a wording collision, not sloppiness.
- **Why it matters:** purely procedural, but it matters *here*: the orchestrator ticks AC13 from
  this review, and as written it cannot. The `no-explicit-any` one is also the avoidable of the two.
- **Suggested direction:** either type the `startViewTransition` stub against the DOM lib's own
  function type instead of casting through `any` (which removes one disable outright and keeps the
  stub honest to the real signature), or get an explicit owner exception recorded the same way the
  AC17 amendment was. I am not making that call.

### Nits

- **N1 — the `columns` computed tracks `showDateCol()` only conditionally.**
  `expenses-table.component.ts:57` — `hasData(exps, field) && !this.isColHidden(field)` short-circuits,
  so when no row carries a `date` the `showDateCol()` read never happens and the signal is not a
  dependency of that computation. Harmless today (with no date data the column is absent either
  way), but it is a reactivity trap: the moment `isColHidden` learns to hide a second column, the
  computed will silently fail to recompute for some input combinations. Direction: read
  `showDateCol()` (and `selectable()`) unconditionally at the top of the computed body so tracking
  is not data-dependent.
- **N2 — the bare tracking read is unexplained.** `expenses-table.component.ts:69` is a lone
  `this.dataSource();` whose only job is to register a dependency. It looks like a leftover and a
  future tidy-up could delete it, silently breaking the flung-row reset that
  `knowledge/flows/delete-expense.md:69` depends on. Direction: one comment saying why the read is
  there.
- **N3 — dead nullable branch.** `expenses-table.component.ts:124-127`'s
  `hasData(exps: ReadonlyArray<Expense> | undefined, …)` guard existed because `ngOnChanges` could
  hand it `undefined`; `dataSource()` is now non-nullable with a `[]` default. Not worth a change on
  its own.
- **N4 — one unrelated file is dirty.** `.claude/agents/implementer.md` is modified (and staged) in
  the working tree, outside AC13's permitted paths. It is a one-line agent-prompt reword, unrelated
  to this spec, and it was already `M` before this work started. Direction: keep it out of this
  commit so AC13 reads cleanly against the change set.
- **N5 — 17 tests vs "at least two".** The spec's Out list says "No new tests in
  `expenses-table.component.spec.ts` beyond what **[AC7]** requires", and AC7 requires "at least
  two". Fifteen extra baseline tests satisfy "at least two" but stretch "beyond what AC7 requires".
  They are good tests written before the migration and they are the reason I can be confident about
  AC3/AC4/AC6 — I am not asking for any of them to be removed. Flagging only because the
  orchestrator ticks that Out-of-scope line, and it is the same class of wording collision the AC17
  amendment already resolved for the other file.

## What I checked

- Read `docs/specs/signal-inputs-outputs.md` and `docs/dod/signal-inputs-outputs.md` in full, and
  confirmed the amended AC17 (`:260-264`) and Out list (`:78-81`) before reviewing.
- `git status --porcelain`, `git diff --stat`, `git diff --cached`, `git log --oneline`.
- Full diffs of: `expenses-table.component.ts`, `expenses-table.component.html`,
  `expenses-table.component.spec.ts`, `statistics.container.ts`, `statistics.container.spec.ts`,
  `knowledge/flows/delete-expense.md`, `knowledge/flows/statistics.md`,
  `knowledge/interfaces/expenses-table-component.md`, `knowledge/log.md`.
- Read the post-change `expenses-table.component.ts` and `statistics.container.ts` end to end, plus
  the current `knowledge/interfaces/expenses-table-component.md`, `knowledge/flows/statistics.md:40-87`,
  `knowledge/log.md:1-45`, `knowledge/operations/testing.md:65-99`.
- `git show HEAD:` for both spec files, to confirm exactly what the pre-existing tests were.
- Consumer templates: `statistics.container.html:20-42`, `dashboard/dashboard-page.container.html:78-84`.
- Greps: `@Input(|@Output(|EventEmitter|@ViewChild|@ContentChild|QueryList|SimpleChanges|ngOnChanges`
  over `src/`; `describe.skip|it.skip|xdescribe|xit(` over `src/`;
  `onDeleteRow|onCellClick|onSelection|ngOnChanges|@ViewChild|@Input|@Output|EventEmitter|defineCols`
  over `knowledge/` and `docs/`; template reads of every migrated member.
- Library sources, to check claims rather than assume them: `SelectionModel.selected`'s declared
  type and memoisation (`node_modules/@angular/cdk/types/_selection-model-chunk.d.ts:19`,
  `node_modules/@angular/cdk/fesm2022/*selection-model*.mjs:11-16`), and Angular's query-signal
  behaviour on destroyed views / required-query throw
  (`node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:9497-9503`, `:9532-9537`).
- `src/@state/app.reducers.ts:14-30`, to establish that the statistics spec's `beforeEach` seeding
  fixes real `localStorage`-dependent flakiness rather than papering over a new failure.
- Ran `bash scripts/harness.sh` (full, green) and
  `npx ng test --watch=false --include <the two spec files>` (23/23 green).
- Did not modify any file other than this review.

## Out of scope

Noticed, deliberately not filed against this change:

- **`formChanged` indexes `sheets[sheetIndex]` with no bounds check**
  (`statistics.container.ts:78-88`, reached from the constructor at `:63-64`). With an empty/unseeded
  store this throws out of the constructor. Pre-existing, unrelated to the migration, and correctly
  left alone by the tester — the new `beforeEach` seeding works around it for the specs. Worth
  raising with the owner separately: it is the reason the pre-existing `should create` test's result
  depended on browser `localStorage`.
- **`startViewTransition` has no rejection handling** in the `expenses$` pipeline
  (`statistics.container.ts:115-123`, `:180-188`). Pre-existing. It became visible only because the
  new tests construct a second container in one test, and the tester stubbed the API rather than
  changing production code — the right call.
- **`knowledge/operations/testing.md:84-85`** lists `local-storage.service.spec.ts` and
  `dialog.component.spec.ts` as `describe.skip`; both are in fact active (only
  `src/app/app.component.spec.ts` is skipped, matching the harness's "1 skipped file / 2 skipped
  tests"). Pre-existing bundle inaccuracy, not caused here — but whoever fixes F4 is standing right
  next to it.
- **Private Material internals** (`MatTabGroup._elementRef`, `._tabHeader`) are copied verbatim per
  the spec's explicit exclusion. Unchanged, not reviewed as a design question.
- The one-line change to `.claude/agents/implementer.md` (see N4) — unrelated agent-prompt edit,
  not part of this spec.
