---
type: Playbook
title: Testing
description: How tests run (Angular's Vitest runner in headless Chromium), what is actually covered, and which suites are skipped.
tags: [operations, testing, vitest, playbook]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: ng
    resource: ../../angular.json
    title: test target configuration
  - id: vitest
    resource: ../../vitest.config.ts
    title: vitest.config.ts
  - id: rules
    resource: ../../.github/rules/testing.md
    title: Testing conventions
  - id: specs
    resource: ../../src
    title: The twelve .spec.ts files
---

# How to run

| Command | Behaviour |
|---|---|
| `npm test` | one pass, `ng test --watch=false` |
| `npm run test:headed` | watch mode — **still headless**; the name refers to watching, not to a visible browser |
| `npm run test:coverage` | one pass with coverage |
| `npx ng test --ui` | Vitest UI for interactive inspection |

The runner is the `@angular/build:unit-test` builder with `runnerConfig: vitest.config.ts`
and `browsers: ["chromiumHeadless"]`, using `tsconfig.spec.json`.[^ng] `vitest.config.ts`
sets `globals: true`, `environment: 'jsdom'`, and `browser.screenshotFailures: false` — note
the browser and jsdom settings coexist; the Angular builder's `browsers` option is what
decides where the tests actually execute.[^vitest]

Because `globals: true` is set together with `"types": ["vitest/globals"]`, specs use
`describe`/`it`/`expect`/`vi` without imports.

`tsconfig.spec.json` explicitly includes `src/logger.ts` so the global `log()` exists in the
test bundle — code under test calls it freely.

# Conventions

`.spec.ts` co-located with the source file. Component specs use `TestBed.configureTestingModule`
with the standalone component in `imports`, and either a stubbed `Store`
(`{ select: vi.fn(), dispatch: vi.fn() }`) or a real `StoreModule.forRoot(reducers)`.

**Effects specs** (`docs/specs/effect-error-surfacing.md`) are the only specs of their kind
in this repo. The pattern, established in `src/@state/app.effects.spec.ts`:
`provideMockActions` from `@ngrx/effects/testing` with a
`Subject<Action>`-backed actions stream; a `Store` stub whose `select` returns an
**observable** (`of(undefined)`, not a bare function — several `AppEffects` fields call
`this.store.select(...)` during class-field initialization, so a non-observable return
throws before any test body runs); stubs for `NetworkStatusService` (needs `online$`) and
`SpreadsheetService`; and, for `MatSnackBar`, `{ provide: MatSnackBar, useValue: { open:
vi.fn() } }` — asserted on via the spy, never against real overlay DOM. A second gotcha
specific to this file: constructing `AppEffects` at all requires the global `log()` to
already exist, because several effect fields call `tap(log)` at field-init time (evaluated
synchronously inside `new AppEffects(...)`, before any subscription) — in production
`main.ts` installs it via a dynamic `import('src/logger.ts')` before bootstrap, but an
isolated `TestBed` construction has nothing to install it. `app.effects.spec.ts` works
around this with a `globalThis.log = () => {}` no-op in `beforeEach`/`afterEach`;
`report-failure.spec.ts` uses a plain `import 'src/logger'` instead, since it calls
`reportFailure(...)` directly rather than constructing `AppEffects`. **Any new effects spec
in this codebase needs one of these two, or it fails with `ReferenceError: log is not
defined` before the test body runs.**

# What is actually covered

| Spec | State | Content |
|---|---|---|
| `src/shared/helpers/index.spec.ts` | **active, 22 tests** | `isExpenseEqual` (13, every field and date component) + `toMessage` (9) |
| `src/services/spreadsheet/spreadsheet.service.spec.ts` | **active, 8 tests** | URLs, verbs, and serial-date conversion via `HttpTestingController` |
| `src/@state/report-failure.spec.ts` | **active** | `reportFailure`'s dispatch order/payloads; asserts the dispatched message is never raw error text |
| `src/@state/app.reducers.spec.ts` | **active** | the `lastError` branch: initial `null`, `id` increments on repeat identical payloads, other `AppState` keys untouched |
| `src/@state/app.effects.spec.ts` | **active** | `showFailureToast$`: opens exactly once with the right message/config (no `duration`, `politeness: 'assertive'`); two `operationFailed` emissions open the snackbar twice |
| `src/modules/dashboard/categories/...spec.ts` | active, 1 test | creation smoke test with a stubbed store |
| `src/modules/dashboard/dashboard.component.spec.ts` | active, 1 test | creation smoke test |
| `src/modules/dashboard/statistics/...spec.ts` | active, 1 test | creation smoke test with a real store |
| `src/shared/components/expenses-table/...spec.ts` | active, 1 test | creation smoke test |
| `src/app/app.component.spec.ts` | **`describe.skip`** | also asserts a title string absent from the current `app.component.html` |
| `src/services/storage/local-storage.service.spec.ts` | **`describe.skip`** | — |
| `src/shared/components/dialog/dialog.component.spec.ts` | **`describe.skip`** | — |

The meaningful coverage is the expense equality helper, `toMessage`, the Sheets service, and
the failure-reporting mechanism (`reportFailure`, the `lastError` reducer branch,
`showFailureToast$`). **The 7 remote effects' actual production logic (the Sheets calls
themselves, the optimistic updates/rollbacks, the `store*` dispatches) is untested** — only
their shared failure path is. Guards, the interceptor, the security services, and the setup
flow have no tests at all. Treat a green run as a regression check on those units, not as a
safety net for [the flows](../flows/).

# Rules

`.github/CLAUDE.md` states two hard rules that apply here: **never delete or overwrite
working tests without explicit permission**, and **always run tests after any code
change**.[^rules] See [working agreements](../constraints/working-agreements.md).

CI does not run tests — see [CI and deployment](ci-and-deployment.md).

There is no end-to-end testing configured.

[^ng]: test target configuration
[^vitest]: vitest.config.ts
[^rules]: Testing conventions
