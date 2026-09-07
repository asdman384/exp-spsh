# Effect error surfacing

## Goal

Make remote failures in `src/@state/app.effects.ts` visible to the user — one `operationFailed`
action, one `lastError` state field, one shared `catchError` helper and one snackbar effect —
so that a failed Sheets read or write stops looking exactly like a slow one; requested by the
repo owner off the back of `knowledge/constraints/known-issues.md` item 10 and locked down in
`docs/architecture/effect-error-surfacing.md`.

## Scope

**In:**

- New action `AppActions.operationFailed({ source, message })` (`src/@state/app.actions.ts`).
- New `AppState.lastError` field, its reducer branch and `lastErrorSelector`
  (`src/@state/app.model.ts`, `app.reducers.ts`, `app.selectors.ts`).
- New pure helper `toMessage(e: unknown): string` in `src/shared/helpers/index.ts`.
- New `src/@state/report-failure.ts` exporting the per-source copy table and the
  `reportFailure(source, store)` `catchError` replacement, adopted by the 5 non-optimistic
  remote effects (`loadCategories$`, `addCategory$`, `deleteCategory$`, `addExpense$`,
  `loadExpenses$`).
- One added `operationFailed` dispatch in each of the 2 optimistic effects
  (`updateCategoryPosition$`, `deleteExpense$`), rollback logic otherwise untouched.
- **Bundled bug fix:** `updateCategoryPosition$`'s rollback at `app.effects.ts:141` is made to
  actually dispatch (`knowledge/constraints/known-issues.md` item 1). Rationale in Decisions.
- New `showFailureToast$` effect inside the existing `AppEffects` class, opening a `MatSnackBar`.
- User-facing copy for all 7 remote effects, decided here, not derived from the raw error.
- Tests: `toMessage`, `reportFailure`, the `lastError` reducer branch, `showFailureToast$`.

**Out (each needs its own spec if wanted):**

- The 4 `{ dispatch: false }` localStorage effects (`saveSpreadsheetId$`, `saveSheetId$`,
  `saveCategoriesSheetId$`, `saveCategories$`). See Decisions D6.
- **Effect death after the first failure.** Every one of the 7 `catchError`s sits on the *outer*
  pipe and returns `EMPTY`, which *completes* the effect stream; NgRx's default effects error
  handler resubscribes on **error** notifications, not on completion, so each of these effects
  stops responding to its trigger action for the rest of the session after its first failure.
  This is pre-existing, undocumented, and structural (it means moving `catchError` inside each
  `exhaustMap` projection, which changes operator topology in all 7 effects and interacts with
  `deleteExpense$`'s rollback). Fixing it here would be a second, larger task. **Follow-up spec
  needed: `effect-resubscription`.** Its practical consequence for this spec is captured in
  [AC16].
- Any UI driven by `lastError` (inline banner, failure-history panel) and any clearing
  semantics for it.
- Retry / "Try again" affordance on the snackbar. The action button is dismiss-only.
- `setup-page.container.ts`'s missing error handling (`known-issues.md` item 9) — a container,
  not an effect, and a separate flow.
- Any change to `SpreadsheetService`, `UIKitModule`, the sheet layout, `ngsw-config.json`,
  `angular.json`, or `package.json`.
- Un-skipping or repairing the three `describe.skip` suites (`known-issues.md` item 13).

## Approach

- **State layer (`src/@state/`) carries all of the new mechanism.** Action shape follows
  `app.actions.ts:4-30` (`createActionGroup` + `props<>()`, grouped under `//` comments);
  reducer branch follows the immutable-spread style of `app.reducers.ts:34-47`; selector follows
  the flat `createSelector(selectAppFeature, …)` style of `app.selectors.ts:9-11` and joins the
  `// general` group.
- **Remote I/O is untouched.** `src/services/spreadsheet/spreadsheet.service.ts` keeps every
  method signature; effects only change what they do with an error they already receive. No new
  Google API surface, no new scope, no component ever makes a call.
- **New file `src/@state/report-failure.ts`** holds three exports: a `FailureSource` union of the
  7 effect property names, a `FAILURE_MESSAGES: Record<FailureSource, string>` copy table, and
  `reportFailure(source: FailureSource, store: Store)` returning a `catchError` callback that
  logs, clears `loading`, dispatches `operationFailed`, and returns `EMPTY`. Naming deviates from
  the `app.*` prefix used by its siblings because it is not part of the feature slice's
  action/reducer/selector quartet — accepted, flagged by the architecture note.
- **`src/shared/helpers/index.ts`** gains `toMessage(e: unknown): string` next to `isExpenseEqual`
  — pure, no DI, tested in the existing co-located `index.spec.ts`.
- **`src/@state/app.effects.ts`** is edited in three ways: 5 five-line `catchError` blocks
  collapse to `catchError(reportFailure('<name>$', this.store))`; the 2 optimistic `catchError`
  blocks (lines 139-144 and 202-224) gain one `this.store.dispatch(AppActions.operationFailed(…))`
  line each; and one new `{ dispatch: false }` effect `showFailureToast$` is added as a sibling
  of the other 11, with `private readonly snackBar: MatSnackBar` appended to the constructor
  (`app.effects.ts:247-252`), matching that file's constructor-injection style.
- **`src/app/app.config.ts` is not modified.** See Decisions D2 — Material 21's snack bar is
  CSS-animated and needs no animations provider.
- **Nothing lands in a container or component.** `MatSnackBar` is `providedIn: 'root'`
  (`node_modules/@angular/material/fesm2022/snack-bar.mjs:584`) and is opened imperatively from
  the effect, so `src/shared/modules/uikit.module.ts` needs no change either.

### Files

| File | Action |
|---|---|
| `src/@state/report-failure.ts` | **create** |
| `src/@state/report-failure.spec.ts` | **create** |
| `src/@state/app.reducers.spec.ts` | **create** |
| `src/@state/app.effects.spec.ts` | **create** |
| `src/@state/app.actions.ts` | modify — add `// errors` group + `operationFailed` |
| `src/@state/app.model.ts` | modify — add `AppError` + `lastError` |
| `src/@state/app.reducers.ts` | modify — `initialState.lastError`, new `on()` branch |
| `src/@state/app.selectors.ts` | modify — `lastErrorSelector` |
| `src/@state/app.effects.ts` | modify — 7 effects, 1 new effect, 1 constructor param, 1 bug fix |
| `src/shared/helpers/index.ts` | modify — add `toMessage` |
| `src/shared/helpers/index.spec.ts` | modify — **append** a `describe('toMessage')`; do not touch the existing 13 `isExpenseEqual` tests |
| `src/@state/index.ts` | **not** modified — `report-failure` stays internal to the slice |
| `src/app/app.config.ts` | **not** modified — see D2 |

## Decisions

### D1 — Snackbar timing and WCAG 2.2.1

| | |
|---|---|
| **Alternatives** | (a) architect's placeholder `duration: 5000`; (b) longer fixed duration (10 s); (c) no `duration` at all — stays until dismissed. |
| **Choice** | **(c)** — `snackBar.open(message, 'Dismiss', { politeness: 'assertive', verticalPosition: 'top' })`, **no `duration` key**. |
| **Reason** | WCAG 2.2.1 (Timing Adjustable) is about *time limits set by the content*. A fixed auto-dismiss is a time limit; none of the SC's exceptions (Real-time, Essential, 20 Hours, or the 20-second-with-10-extensions carve-out) cover an error notification, and a `Dismiss` button lets the user end the limit early but not *extend* it, which is what the SC asks for. Removing `duration` removes the time limit entirely, so the SC becomes not applicable — the cleanest AA outcome, and the one `.claude/rules/code-style.md` ("MUST pass all AXE checks… WCAG AA minimums") points at. `MatSnackBar` shows one snackbar at a time (a new `open()` replaces the previous), so a persistent toast cannot stack. |

Supporting sub-decisions, same call:

- `politeness: 'assertive'` — set explicitly rather than relying on the `MatSnackBarConfig`
  default, so the container resolves to `role="alert"` and the failure is announced immediately
  rather than queued behind other live-region output
  (`node_modules/@angular/material/fesm2022/snack-bar.mjs:306-327`).
- `verticalPosition: 'top'` — the bottom of the viewport is occupied by the always-on logger
  toggle (`src/styles.scss:22-56`, and `known-issues.md` item 12: the overlay ships to every
  user), which is exactly the affordance a user is asked for when something fails. A persistent
  bottom-centre snackbar would sit on top of it.
- Action label: `Dismiss` — a real, focusable, visibly labelled control; nothing custom needed
  for keyboard access, and the CDK overlay renders it at the end of the document so it is
  reachable by Tab.
- No `announcementMessage` is passed, so Material announces the message itself and does not
  double-announce.

### D2 — Animations provider

| | |
|---|---|
| **Alternatives** | (a) `provideAnimationsAsync()` as the architecture note proposes; (b) `provideNoopAnimations()`; (c) **neither — leave `app.config.ts` untouched.** |
| **Choice** | **(c)**. |
| **Reason** | The note's premise ("required for `MatSnackBar`") does not hold for Material 21. `MatSnackBarContainer` animates purely in CSS — it toggles `.mat-snack-bar-container-enter` and a `mat-exit` attribute (`snack-bar.mjs:507`, `386`) and only consults `_animationsDisabled()`, which reads the *optional* `ANIMATION_MODULE_TYPE` token plus `prefers-reduced-motion` (`node_modules/@angular/material/fesm2022/_animation-chunk.mjs:6-19`). With no provider present, `ANIMATION_MODULE_TYPE` injects `null`, animations run, and `prefers-reduced-motion` is honoured automatically — a free WCAG 2.3.3 win. The app already ships Material menus, tabs, datepickers and tooltips with **no** animations provider in `src/app/app.config.ts:33-64` and they work, which is the empirical confirmation. Adding `provideAnimationsAsync()` would introduce the app's first `@angular/animations` engine load for zero visual difference. |
| **Fallback** | If, during implementation, the snackbar visibly fails to enter/leave or never removes itself from the DOM, add `provideAnimationsAsync()` from `@angular/platform-browser/animations/async` to the `providers` array in `src/app/app.config.ts` — the dependency is already in `package.json:17` and the subpath export exists, so no `package.json` write is needed. This is not the expected path. |
| **Consequence** | `@angular/animations` remains a declared-but-unprovided dependency. Removing it is a `package.json` write, which `policy/sprint-window.json` denies — **decision needed from owner** if that cleanup is wanted; it is out of scope here. |

### D3 — What `message` actually contains, and where `toMessage` is used

| | |
|---|---|
| **Alternatives** | (a) architecture note's assumption — `message = toMessage(e)`, i.e. the raw derived Google/HTTP text; (b) friendly per-effect copy, raw text dropped; (c) friendly copy in the action, raw text still normalised into the log overlay. |
| **Choice** | **(c)** — `operationFailed.message` is always one of the 7 strings in `FAILURE_MESSAGES`; `toMessage(e)` output goes into the `log()` line only, never into the toast or `lastError`. |
| **Reason** | The brief requires "no jargon, no raw error text" in the user-facing string, and Google's envelope emits things like `Unable to parse range: Sheet1!A1:E`. `toMessage` still earns its keep: it collapses four unrelated throw shapes into one readable line for the always-on log overlay, which is the only debugging surface this app has, and it stays a pure, individually testable function as the architecture note requires. |
| **Shape kept intact** | `operationFailed({ source, message })` and `lastError: { id, source, message }` are exactly as locked. No `detail` field was added — the raw text lives in the log, not in the store. |

`FAILURE_MESSAGES` lives next to `reportFailure` so the 5 helper-based effects pass only a
`source` (matching the locked `reportFailure(source, store)` signature) and the 2 optimistic
effects read the same table when they dispatch `operationFailed` directly. `FailureSource` is a
string-literal union, not an index signature, so `noPropertyAccessFromIndexSignature` permits dot
access.

### D4 — Copy, per effect

| Source | User-facing message |
|---|---|
| `loadCategories$` | `Couldn't load your categories. Check your connection and try again.` |
| `addCategory$` | `Couldn't add that category. Please try again.` |
| `deleteCategory$` | `Couldn't delete that category. Please try again.` |
| `updateCategoryPosition$` | `Couldn't save the new order. Your categories were put back the way they were.` |
| `addExpense$` | `Couldn't save that expense. Please try again.` |
| `deleteExpense$` | `Couldn't delete that expense. It's back in your list.` |
| `loadExpenses$` | `Couldn't load your expenses. Check your connection and try again.` |

Rules the copy follows: one or two short sentences; says what failed in the user's own vocabulary
(categories, expenses, order); tells the user what happened to their data when an optimistic
update was rolled back; never names an effect, an HTTP status, a sheet range, or Google. The two
`Check your connection` variants are the read paths, where a network cause is the likely one; the
write paths say `Please try again` because `exhaustMap` has already released and a retry is the
correct next move. Implementation note: these strings contain an apostrophe, so Prettier
(`singleQuote: true`, `.prettierrc`) will render them as double-quoted literals — that is expected,
do not hand-escape.

### D5 — Bundle the `updateCategoryPosition$` rollback bug fix

| | |
|---|---|
| **Alternatives** | (a) separate follow-up spec; (b) bundle it here. |
| **Choice** | **(b) bundle**. |
| **Reason** | Not a second feature — a precondition for this one. `app.effects.ts:141` builds `AppActions.storeCategories({ categories: this.categoriesBackUp })` and throws the action away (`known-issues.md` item 1). This spec adds a toast on the very next line whose copy says "Your categories were put back the way they were." Shipping the toast over a UI that did not roll back would state something false to the user. Fixing the silent-failure gap in this effect therefore necessarily includes making its existing rollback actually work. The change is one line, on the exact line the diff already touches, and adds no new behaviour beyond what the code already intended. |
| **Not bundled** | `known-issues.md` items 2 and 3 (`deleteExpense$`'s 100-row window and positional row deletion) are adjacent but genuinely separate defects — the toast copy for `deleteExpense$` makes no claim that depends on them. Left alone. |

### D6 — The 4 localStorage-only effects

| | |
|---|---|
| **Alternatives** | (a) route them through `reportFailure` too; (b) out of scope, explicitly. |
| **Choice** | **(b) out of scope for this spec** — a deliberate no, not an omission. |
| **Reason** | `LocalStorageService.put` *can* throw (`QuotaExceededError`, Safari private-browsing storage restrictions) and today that is fully uncaught, so the throw escapes into the effect stream and — like every other error here — kills the effect. But it is a different failure class from the one this spec addresses: synchronous, non-network, non-retryable, and with a completely different remedy (free up storage / leave private browsing) that none of the 7 copy strings above fits. It also has a different blast radius: these effects are the persistence path, so failing silently there means state that looks saved and is not, which argues for a *different* treatment (a persistent warning, not a transient toast) rather than the same one. **Follow-up spec needed: `storage-write-failures`.** |

### D7 — How `lastError.id` is produced

| | |
|---|---|
| **Alternatives** | (a) `Date.now()` computed inside the reducer; (b) `Date.now()` carried on the action; (c) a counter derived from state: `(state.lastError?.id ?? 0) + 1`. |
| **Choice** | **(c)**. |
| **Reason** | (a) makes the reducer impure and its test non-deterministic, against `.claude/rules/code-style.md` ("keep state transformations pure and predictable"). (b) would change the locked `operationFailed({ source, message })` action shape. (c) is pure, deterministic, needs no instance state, and preserves the architecture note's actual stated rationale for `id`: two consecutive byte-identical failures still produce two distinct `lastError` objects, so a future selector-driven consumer cannot silently collapse them. The free "how long ago" timestamp is lost; the log overlay is already the timeline. |

### D8 — `toMessage` precedence

Checked in this order, first match wins:

1. `e instanceof HttpErrorResponse` → if `e.error` carries the Google envelope
   (`e.error.error.message`, a non-empty string), return that; otherwise return
   `` `${e.status} ${e.statusText}` ``.
   **Deliberately skips `e.message`**, which the architecture note listed as an intermediate
   fallback: Angular synthesises it as `Http failure response for URL …`, and the same note
   forbids surfacing the request URL because `SpreadsheetService` puts the spreadsheet id and
   `keys.API_KEY` in the query string. The note is internally inconsistent on this point; this
   spec resolves it in favour of the redaction rule. Never returns headers or the URL.
2. `typeof e === 'string'` → returned as-is (covers the literal
   `` throw `cannot find category [...]` `` at `app.effects.ts:110`).
3. `e instanceof Error` → `e.message` only, **never** `.stack` (covers
   `spreadsheet.service.ts:319`'s `Invalid response format from Google Sheets API` and
   `secureParseDate`'s `should provide a valid date`).
4. anything else, or a matched shape that yields an empty string → the fixed literal
   `Something went wrong. Please try again.`

`HttpErrorResponse` is imported as a value from `@angular/common/http` for the `instanceof`
check. That is a runtime import into `src/shared/helpers/index.ts`, which is otherwise
dependency-free; accepted as clearer and safer than duck-typing on `status`/`statusText`, and it
introduces no DI.

### D9 — `showFailureToast$` reacts to the action stream

Unchanged from the architecture note and restated because a test depends on it: the effect is
`ofType(AppActions.operationFailed)` over `Actions`, `{ dispatch: false }`, **not** a
subscription to `lastErrorSelector`. The action stream is not deduplicated, so identical
consecutive failures each open a snackbar. `lastError` is written by the reducer purely as a
debugging record and is never read by this feature.

## Risks

- **No sheet-layout, row-index or date-conversion exposure.** This change touches no column, no
  tab name, no `A1:E{n}` range, no gviz `select`, no `getDateFromSerialNumber`. No user's
  existing spreadsheet data is at risk, and no migration story is needed. This is the single most
  important thing about its blast radius.
- **Store shape change is additive only.** `lastError` is a new nullable field, always `null` at
  boot, deliberately outside the four keys `initialState` hydrates from `LocalStorageService`
  (`app.reducers.ts:14-23`). `LocalStorageService` reads and writes nothing new, so an existing
  user's persisted state stays readable. No `sheetsAdapter` interaction.
- **Highest blast radius is `app.effects.ts` itself.** Seven `catchError` blocks are rewritten in
  a file with zero test coverage today. The rewrite must preserve, per effect: the existing
  `loading(false)` dispatch, the `EMPTY` return, and — in the two optimistic effects — the exact
  rollback logic and its ordering. A dropped `loading(false)` leaves a spinner running forever;
  a dropped rollback silently corrupts what the user sees.
- **`deleteExpense$`'s `catchError` is the delicate one** (`app.effects.ts:202-224`): it does not
  return `EMPTY`, it returns a mapped `store.select(expensesSelector)` pipeline, and it mutates
  `this.deletedExpenseBackup`. The added `operationFailed` dispatch must go on **both** exit
  paths — the early `if (!backup)` return at lines 206-209 and the restore pipeline — or a
  delete that failed before the optimistic removal produces no toast at all.
- **Effect death after the first failure** (scoped out above) means the toast fires at most once
  per effect per session, and the operation cannot be retried afterwards without a page reload.
  Do not write a test that asserts two toasts from two consecutive failures of the same effect —
  it will fail for that reason, not because of this feature. This should also be recorded as a
  new entry in `knowledge/constraints/known-issues.md`; that file is outside the write policy's
  `src/` window, so it belongs to the follow-up spec.
- **Persistent snackbar occludes content.** With no `duration`, an unnoticed toast stays up.
  Mitigated by `verticalPosition: 'top'` (away from the logger toggle and bottom-anchored
  controls), by Material showing only one snackbar at a time, and by the visible `Dismiss`
  button. If a review finds the top position colliding badly with `mat-toolbar` on small
  screens, that is a CSS-only follow-up, not a redesign of this mechanism.
- **`AppEffects` construction in tests is order-sensitive.** Several effect fields call
  `this.store.select(...)` during field initialisation (`app.effects.ts:90`, `105`, `131`, `174`),
  which only works because `useDefineForClassFields: false`. A `Store` stub whose `select`
  returns a non-observable will make `TestBed.inject(AppEffects)` throw before any test body runs.
- **`log()` is a global** installed by `src/logger.ts`. `tsconfig.spec.json:8` includes that file
  in the spec bundle, so it exists under test — but the new specs assert on `log` behaviour
  indirectly at most; do not build a test that depends on the overlay's DOM.
- **Lint/type gates.** `no-explicit-any` is an error — `toMessage` takes `unknown` and must
  narrow, not cast. `noPropertyAccessFromIndexSignature` is on — hence `FailureSource` as a
  literal union rather than `Record<string, string>`.

## Acceptance criteria

**Action, model, reducer, selector**

- `[AC1]` `src/@state/app.actions.ts` declares `operationFailed: props<{ source: string; message: string }>()`
  under a new `// errors` section comment placed after the `// general` group. No existing event
  is renamed or reordered.
- `[AC2]` `src/@state/app.model.ts` declares an exported `AppError` interface
  `{ id: number; source: string; message: string }` and adds `lastError: AppError | null` to
  `AppState`. No other field changes.
- `[AC3]` `src/@state/app.reducers.ts` sets `lastError: null` as a literal in `initialState` (not
  read from `LocalStorageService`) and adds a single `on(AppActions.operationFailed, …)` branch
  that returns an immutable spread setting
  `lastError: { id: (state.lastError?.id ?? 0) + 1, source, message }`.
- `[AC4]` `src/@state/app.selectors.ts` exports `lastErrorSelector`, a flat
  `createSelector(selectAppFeature, (state: AppState) => state.lastError)`, placed in the
  `// general` group.
- `[AC5]` A new `src/@state/app.reducers.spec.ts` proves, against the real reducer: initial
  `lastError` is `null`; one `operationFailed` sets `source`, `message` and `id === 1`; a second
  `operationFailed` with an **identical** payload produces a *new* object with `id === 2`; and
  the branch leaves every other `AppState` key untouched.

**`toMessage`**

- `[AC6]` `src/shared/helpers/index.ts` exports `toMessage(e: unknown): string` implementing D8's
  precedence. It takes `unknown` (no `any`, no assertion casts that would trip
  `@typescript-eslint/no-explicit-any`).
- `[AC7]` `src/shared/helpers/index.spec.ts` gains a `describe('toMessage')` block — **appended,
  with all 13 existing `isExpenseEqual` tests intact** — covering, one test each: an
  `HttpErrorResponse` carrying a Google envelope (`{ error: { message: '…' } }`) returns the
  envelope message; an `HttpErrorResponse` without one returns `` `${status} ${statusText}` ``;
  the returned string for an `HttpErrorResponse` constructed with a `url` never contains that
  url; a thrown `string` is returned verbatim; an `Error` returns `.message` and never `.stack`;
  an `Error` with an empty message falls through to the generic literal; and `undefined`,
  `null` and `{}` each return the generic literal.

**`reportFailure`**

- `[AC8]` `src/@state/report-failure.ts` exists and exports `FailureSource` (a string-literal
  union of exactly the 7 effect property names, `$` suffix included),
  `FAILURE_MESSAGES: Record<FailureSource, string>` containing verbatim the 7 strings from D4,
  and `reportFailure(source: FailureSource, store: Store)`.
- `[AC9]` The observable returned by `reportFailure(...)(<error>)` completes without emitting,
  and before completing it has: called the global `log`; dispatched
  `AppActions.loading({ loading: false })`; and dispatched
  `AppActions.operationFailed({ source, message: FAILURE_MESSAGES[source] })` — in that order.
- `[AC10]` `src/@state/report-failure.spec.ts` proves [AC9] with a stubbed store
  (`{ dispatch: vi.fn() }`, the pattern already used in
  `src/modules/dashboard/categories/categories-page.container.spec.ts:15`), asserts the dispatch
  order and the exact payloads, and asserts that the dispatched `message` is **never** the raw
  error text for at least one `HttpErrorResponse` case.

**Effects**

- `[AC11]` In `src/@state/app.effects.ts`, `loadCategories$`, `addCategory$`, `deleteCategory$`,
  `addExpense$` and `loadExpenses$` each terminate in
  `catchError(reportFailure('<own property name>$', this.store))` and contain no other
  `catchError`. The `source` string of each matches its own effect property name exactly.
- `[AC12]` `updateCategoryPosition$`'s `catchError` (was `app.effects.ts:139-144`) now (a)
  dispatches the rollback — `this.store.dispatch(AppActions.storeCategories({ categories: this.categoriesBackUp }))`,
  fixing `known-issues.md` item 1 — (b) still dispatches `loading(false)`, (c) additionally
  dispatches `operationFailed({ source: 'updateCategoryPosition$', message: FAILURE_MESSAGES.updateCategoryPosition$ })`,
  and (d) still returns `EMPTY`.
- `[AC13]` `deleteExpense$`'s `catchError` (was `app.effects.ts:202-224`) dispatches
  `operationFailed({ source: 'deleteExpense$', … })` on **both** exit paths — the `if (!backup)`
  early return and the restore pipeline. Its existing rollback logic, its `deletedExpenseBackup`
  handling and its `storeExpenses` emission are byte-for-byte unchanged apart from the added
  dispatches.
- `[AC14]` `AppEffects` gains exactly one constructor parameter,
  `private readonly snackBar: MatSnackBar`, appended after `spreadSheetService`
  (`app.effects.ts:247-252`); no existing parameter is reordered.
- `[AC15]` A new `showFailureToast$` effect exists inside `AppEffects`, declared
  `{ dispatch: false }`, listening `ofType(AppActions.operationFailed)`, calling
  `this.snackBar.open(message, 'Dismiss', { politeness: 'assertive', verticalPosition: 'top' })`
  with **no `duration` key**.
- `[AC16]` A new `src/@state/app.effects.spec.ts` uses `provideMockActions` from
  `@ngrx/effects/testing` (already available at `node_modules/@ngrx/effects/package.json:61` —
  no new dependency) with a `Subject`-backed actions stream, a `Store` stub whose `select`
  returns an observable, stubs for `NetworkStatusService` (with an `online$`) and
  `SpreadsheetService`, and `{ provide: MatSnackBar, useValue: { open: vi.fn() } }`. It proves:
  subscribing to `showFailureToast$` and emitting one `operationFailed` calls `open` exactly once
  with the action's `message`, the literal `'Dismiss'`, and a config object that has no
  `duration` property and has `politeness: 'assertive'`; and that two consecutive `operationFailed`
  emissions (identical payloads) call `open` twice. Assert on the `open` spy — do not assert on
  real overlay DOM.

**Whole-repo gates**

- `[AC17]` `src/app/app.config.ts` is unchanged; no animations provider is added (D2), and the
  snackbar is confirmed to appear and disappear in a manual run of `npm run watch` +
  `npm run serve` at `http://localhost:4200/exp-spsh/`.
- `[AC18]` `src/@state/index.ts`, `src/shared/modules/uikit.module.ts`,
  `src/services/spreadsheet/spreadsheet.service.ts`, `ngsw-config.json`, `angular.json` and
  `package.json` are all unchanged.
- `[AC19]` `npm test` passes with the 13 pre-existing `isExpenseEqual` tests and the 8
  `SpreadsheetService` tests still green, plus the new suites; `npm run lint` and
  `npx tsc -b tsconfig.app.json tsconfig.spec.json` are clean.
- `[AC20]` Manual accessibility check on a forced failure (e.g. revoke network, trigger
  `loadExpenses$`): an AXE scan of the page with the snackbar open reports no new violations, the
  container resolves to `role="alert"`, and the `Dismiss` button is reachable and operable by
  keyboard.
