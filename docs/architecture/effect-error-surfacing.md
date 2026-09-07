# Effect error surfacing — architecture

## Context

Every remote-calling effect in `src/@state/app.effects.ts` ends `catchError -> log(e) ->
loading(false) -> EMPTY` (documented in `knowledge/architecture/state-management.md`
"Effects catalogue" and `knowledge/constraints/known-issues.md` item 10). A failed write or
read is indistinguishable from a slow one: the loading spinner stops and nothing else
happens. This note locks the shape of a generic failure-reporting path — one action, one
state field, one shared `catchError` helper, one toast effect — so the planner can write a
spec against a fixed structure instead of re-deriving it per effect. Scope is limited to the
7 remote-calling effects; the 4 `{ dispatch: false }` localStorage-persistence effects
(`saveSpreadsheetId$`, `saveSheetId$`, `saveCategoriesSheetId$`, `saveCategories$`) are
explicitly out of scope, per the brief.

## Existing patterns to follow

- Action group shape: `src/@state/app.actions.ts:4-30` — `createActionGroup` with `props<>()`
  per event, grouped under `//` section comments (`// general`, `// setup`, `// categories`,
  `// expenses`).
- Reducer shape: `src/@state/app.reducers.ts:32-48` — every `on()` handler is an immutable
  spread, no exceptions.
- Selector shape: `src/@state/app.selectors.ts:8-11` — flat `createSelector(selectAppFeature,
  (state) => state.field)` for scalar fields, grouped under the same section comments as the
  actions.
- Effect shape: `src/@state/app.effects.ts:66-80` (`loadCategories$`) is the canonical
  "simple remote effect" — `tap(log)` first, `exhaustMap` over the service call, terminate in
  a `store*` action, `catchError` logs and clears `loading`.
- Constructor injection is the dominant DI style in this exact file
  (`src/@state/app.effects.ts:247-252`); `inject()` is reserved for newer code elsewhere. New
  dependencies on `AppEffects` should follow the constructor-parameter-property form already
  there.
- `EffectsModule.forRoot(AppEffects)` is wired once in `src/app/app.config.ts:59`, inside the
  single `importProvidersFrom([...])` block that also registers the store and service worker.

## Decisions

| Decision | Detail |
|---|---|
| **One new action** | `AppActions.operationFailed({ source: string; message: string })`, added to `app.actions.ts` under a new `// errors` section comment, after `// general`. |
| **One new state field** | `lastError: { id: number; source: string; message: string } \| null` on `AppState`. `id` is `Date.now()` at dispatch time — see rationale below. |
| **Field is not persisted** | `initialState.lastError` is always `null`, set as a literal, not read from `LocalStorageService`. |
| **Field is never explicitly cleared** | `lastError` is a "last failure" record, not a "currently displayed error" flag — see rationale below. |
| **Shared catchError helper** | `toMessage(e: unknown): string` (pure, `src/shared/helpers/index.ts`) + `reportFailure(source: string, store: Store)` (NgRx-aware, new file `src/@state/report-failure.ts`), used by the 5 non-optimistic remote effects. |
| **Optimistic effects don't call `reportFailure`** | `updateCategoryPosition$` and `deleteExpense$` keep their bespoke `catchError`, and add one `store.dispatch(AppActions.operationFailed(...))` call using `toMessage` directly — see below. |
| **Toast effect lives in `AppEffects`** | `showFailureToast$`, `{ dispatch: false }`, added as a sibling to the other 11 effects, not a new effects class. |
| **`MatSnackBar` provisioning** | Inject via constructor param on `AppEffects`, following that class's existing style. Requires an animations provider — add `provideAnimationsAsync()` to `app.config.ts`. |

### Why `lastError.id` (a decision worth spelling out)

`showFailureToast$` reacts to the **action stream** (`ofType(AppActions.operationFailed)`
inside `Actions`), not to a selector over `lastError`. NgRx's `Actions` stream is not
deduplicated — two dispatches with byte-identical payloads both flow through and both open a
snackbar. So the toast itself needs no `id` to fire correctly.

The `id` earns its place for the **state field**, not the toast: `lastError` is read via a
memoized selector (see below), and if a future consumer (a status line, a debug panel) uses
that selector with `distinctUntilChanged`-style logic — or simply keys a `@for` track
expression on message content — two consecutive identical failures (e.g. the network drops
twice in a row on the same `loadExpenses$` call) would otherwise look like one occurrence.
`Date.now()` as `id` makes every failure a distinct object even when `source` and `message`
are equal. Alternatives considered: no id (rejected — silently collapses repeat failures in
any future selector-driven UI); an incrementing counter on `AppEffects` (rejected — `Date.now()`
needs no extra instance state and doubles as a "how long ago" timestamp for free).

### Why `lastError` is not cleared

Clearing it (e.g. on snackbar dismiss) would require plumbing `MatSnackBarRef` dismiss/action
events back into a new dispatched action, which nothing in this design currently needs — the
toast is driven by the action stream, not by `lastError` becoming non-null. Leaving it as a
"last failure" record makes it a second debugging signal alongside the `log()` overlay
(`knowledge/constraints/known-issues.md` item 12 notes the overlay is on for every user in
production) at zero extra dispatch cost. If a later feature wants an inline error banner
driven by `lastError`, clearing becomes a real requirement then — flagged under Open
questions.

## Boundaries

**New:**
- `src/@state/report-failure.ts` — exports `reportFailure(source: string, store: Store)`,
  returning a `catchError` callback: `log(e)` → `dispatch(loading(false))` →
  `dispatch(operationFailed({ source, message: toMessage(e) }))` → `EMPTY`. Named without the
  `app.*` prefix used elsewhere in `src/@state/` because it is not part of the `app` feature
  slice's action/reducer/selector quartet — flag this minor naming deviation for the planner.
- `AppActions.operationFailed` in `src/@state/app.actions.ts`.
- `lastError` field in `AppState` (`src/@state/app.model.ts`) and its reducer branch
  (`src/@state/app.reducers.ts`).
- `lastErrorSelector` in `src/@state/app.selectors.ts`, in the `// general` group next to
  `loadingSelector`.
- `toMessage(e: unknown): string` in `src/shared/helpers/index.ts`, alongside
  `isExpenseEqual` — a pure function with no DI, matching that file's existing contents and
  test file (`src/shared/helpers/index.spec.ts`).
- `showFailureToast$` effect inside the existing `AppEffects` class.
- `provideAnimationsAsync()` added to the providers array in `src/app/app.config.ts:33-64`.

**Touched (minimal diff per effect):**
- `src/@state/app.effects.ts` — `loadCategories$`, `addCategory$`, `deleteCategory$`,
  `addExpense$`, `loadExpenses$`: each 5-line `catchError((e) => { log(e); ...; return EMPTY;
  })` block collapses to `catchError(reportFailure('loadCategories$', this.store))` (source
  string = the effect's own property name, one per effect, for traceability back to this
  file).
- `src/@state/app.effects.ts` — `updateCategoryPosition$` (catchError at lines 139-144) and
  `deleteExpense$` (catchError at lines 202-224): one added line each,
  `this.store.dispatch(AppActions.operationFailed({ source: '<effectName>$', message:
  toMessage(e) }))`, placed alongside their existing rollback dispatch(es). Rollback logic
  itself is untouched.
- `AppEffects` constructor (`src/@state/app.effects.ts:247-252`) — one new parameter,
  `private readonly snackBar: MatSnackBar`.

**NOT touched (and why):**
- The 4 `{ dispatch: false }` persistence effects — out of scope per the brief; they wrap
  synchronous `LocalStorageService.put` calls with no network round-trip, so "failure" there
  is a different problem (see Open questions).
- `SpreadsheetService` (`src/services/spreadsheet/spreadsheet.service.ts`) — no method
  signatures change; effects still receive whatever it throws or emits as an error today
  (`HttpErrorResponse` from every `HttpClient` call, a plain string from `deleteCategory$`'s
  own `throw` at `app.effects.ts:110`, or a plain `Error` from the gviz-parsing failure path
  inside `loadExpenses` at `spreadsheet.service.ts:319`).
- `UIKitModule` (`src/shared/modules/uikit.module.ts`) — `MatSnackBar` is
  `providedIn: 'root'` and opened imperatively (`.open(...)`), not referenced from a
  template, so it needs no module import there. Only the animations provider is a real gap.
- `sheetsAdapter` / entity adapter shape — `lastError` is a plain nullable object, not an
  entity collection; no adapter interaction.
- The known bug in `updateCategoryPosition$`'s rollback (`knowledge/constraints/known-issues.md`
  item 1: the restored-categories action is built but never dispatched, at
  `app.effects.ts:141`) — this design adds a line next to it but does not fix it. Whether
  fixing it rides along with this change or ships separately is a planner call, flagged
  below.

## Data

- **No spreadsheet layout change.** This feature touches no column, no tab, no `A1:E{n}`
  range, no gviz `select`. Nothing here needs a migration story for existing spreadsheets.
- **No wire-format change against Google APIs.** `SpreadsheetService` methods and their
  request/response shapes are unchanged; effects only change what they do with an error they
  already receive.
- **Store shape change:** one field added to `AppState`, `lastError`. It is deliberately
  outside the four keys `initialState` hydrates from `LocalStorageService`
  (`spreadsheetId`, `categoriesSheetId`, `categories`, `dataSheets` —
  `src/@state/app.reducers.ts:14-23`); it is always `null` at boot, same treatment as
  `expenses` (`knowledge/architecture/state-management.md`, "Hydration from localStorage" —
  "`expenses` is never persisted; it is always re-fetched"). No change to what
  `LocalStorageService` reads or writes.

## Integration points

- No new Google API surface, no new OAuth scope, no change to which read path
  (gviz vs `values.get`) any effect uses.
- `MatSnackBar` is a client-side-only Angular Material integration; no network call, no
  service-worker interaction, nothing to add to `ngsw-config.json`.
- `@angular/animations` is already a listed dependency in `package.json` (line 17) but is
  currently provided nowhere in `src/app/app.config.ts`. Adding `provideAnimationsAsync()`
  (from `@angular/platform-browser/animations/async`) activates an already-approved
  dependency rather than introducing a new one, so it does not trip the
  `policy/sprint-window.json` restriction on `package.json` writes. `provideAnimationsAsync()`
  is preferred over `provideAnimations()` for the bundle-budget reasons already cited for
  `StoreDevtools` in `knowledge/constraints/technical-constraints.md` ("Bundle budgets") —
  it lazy-loads the animations engine instead of adding it to the initial chunk.
  **Alternative considered:** `provideNoopAnimations()` (no visual transition, smallest
  bundle impact, zero risk) — rejected as the default here only because a silently
  non-animated snackbar is a UX call, not a structural one; flagged below for a human owner
  to confirm.

## `toMessage` behavior

Signature: `toMessage(e: unknown): string`, `src/shared/helpers/index.ts`. Known error shapes
in this codebase, in priority order:

1. `HttpErrorResponse` (every `SpreadsheetService` call goes through `HttpClient`) — prefer
   Google's own nested envelope if present (`error.error.error.message`, the standard Google
   API error body), else fall back to `error.message` (Angular's synthesized "Http failure
   response for URL ..." string) or `` `${status} ${statusText}` ``. Never surface response
   headers or the request URL (may contain the spreadsheet id / API key as a query param —
   see `spreadsheet.service.ts`'s `key: keys.API_KEY` params).
2. `string` (the literal `` throw `cannot find category [...]` `` at `app.effects.ts:110`) —
   used as-is; it is already a short, developer-authored sentence, not a stack trace.
3. `Error` (e.g. `throw new Error('Invalid response format from Google Sheets API')` in
   `spreadsheet.service.ts:319`, or `throw Error('should provide a valid date')` in
   `secureParseDate`) — use `.message` only, never `.stack`.
4. Anything else (unknown shape) — a fixed generic string (e.g. "Something went wrong.
   Please try again."), so nothing unrecognized leaks into the UI.

## Conflicts with existing patterns checked

- `.claude/rules/code-style.md`'s "use signals, not other state patterns" and "no `mutate` on
  signals" rules govern **component-local** state; `AppState` is an NgRx store slice, a
  different layer, and is unaffected — confirmed by scanning `app.model.ts` / `app.reducers.ts`,
  which use plain interfaces and `createReducer`, not signals, today.
- `.claude/rules/code-style.md`'s accessibility requirements (WCAG AA, focus management) *do*
  apply to the snackbar and are a real open question — see below.
- No conflict with the entity adapter (`sheetsAdapter`) or with `Category.id`/`Sheet.id`
  semantics — `lastError` doesn't touch either.
- `EffectsModule.forRoot(AppEffects)` currently takes a single class
  (`src/app/app.config.ts:59`); keeping `showFailureToast$` inside `AppEffects` avoids
  changing that call to an array, which is the smallest-diff option consistent with "one
  effects class today."

## Testing implications

- `knowledge/operations/testing.md` is explicit: **effects have no test coverage today** —
  there is no `app.effects.spec.ts` in the repo (confirmed by globbing `**/*.spec.ts`), and no
  established pattern here for `@ngrx/effects/testing`'s `provideMockActions`. This feature
  does not inherit a pattern to follow for effect-level tests; the tester will be establishing
  one, not extending one.
- `toMessage` is a pure function with the same shape as `isExpenseEqual`
  (`src/shared/helpers/index.ts` / `index.spec.ts`, "active, 13 tests" per
  `knowledge/operations/testing.md`) — it fits directly into that existing spec file and that
  existing test pattern; no new test infrastructure needed for it.
- `reportFailure` is a thin dispatcher (`log`, `store.dispatch` x2, `EMPTY`) and is
  straightforward to unit test with a stubbed `Store` (`{ dispatch: vi.fn() }`), matching the
  "stubbed store" pattern already used in
  `src/modules/dashboard/categories/categories-page.container.spec.ts`.
  `showFailureToast$` needs either a stubbed `MatSnackBar` or `provideMockActions` — neither
  has a precedent in this repo; per my role I don't pick which, that's for the tester.
- CLAUDE.md's "ALWAYS run tests after any code change" and "NEVER delete or overwrite working
  tests without explicit permission" apply as-is; nothing in this design requires touching an
  existing test file.

## Open questions

- **Snackbar auto-dismiss vs. WCAG 2.2.1 (Timing Adjustable).** `.claude/rules/code-style.md`
  requires WCAG AA. A 5-second auto-dismissing toast with no way to re-open it is a known
  accessibility anti-pattern for error messages specifically (the user may not finish reading
  before it's gone). Whether to keep `duration: 5000`, extend it, make it manual-dismiss-only
  for errors, or set `politeness: 'assertive'` on `MatSnackBarConfig` needs a decision.
  **Owner: UX/accessibility owner.**
- **`provideAnimationsAsync()` vs `provideNoopAnimations()`.** Structural default proposed
  above; final call on whether a first-ever animation in this app is wanted at all, or
  whether a static/no-animation snackbar is preferred, needs sign-off. **Owner: tech
  lead / UX owner.**
- **Message copy per effect.** Whether `operationFailed.message` should stay literally
  whatever `toMessage` derives from the Google error, or whether each of the 5-7 call sites
  should pass a friendlier, feature-specific string (e.g. "Couldn't delete this category" vs.
  a raw Google API message) is a product/copy decision, not a structural one. This note
  assumes the raw derived message for now. **Owner: product/UX.**
- **Whether to fix the `updateCategoryPosition$` rollback-never-dispatches bug
  (`knowledge/constraints/known-issues.md` item 1) as part of this change.** This design's
  diff sits directly next to that bug. Bundling the fix reduces total churn on that block;
  leaving it separate keeps this change a pure error-surfacing feature. **Owner: planner /
  engineering lead deciding scope.**
- **Whether the 4 localStorage-only persistence effects need any failure signal at all.**
  `LocalStorageService.put` can throw (e.g. quota exceeded, private-browsing storage
  restrictions in Safari) and today that's fully uncaught. Out of scope per the brief, but
  worth a deliberate yes/no rather than a silent omission. **Owner: planner.**
- **Multiple features implied.** This note covers only the error-surfacing mechanism. Any
  follow-on UI (an inline error banner driven by `lastError`, a "history of failures" panel)
  is a separate feature and would need its own architecture pass if `lastError`'s clearing
  semantics need to change. **Owner: whoever scopes the next feature.**
