---
type: Playbook
title: Testing
description: How tests run (Angular's Vitest runner in headless Chromium), what is covered, and the test-writing gotchas.
tags: [operations, testing, vitest, playbook]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
sources:
  - id: ng
    resource: ../../angular.json
    title: test target configuration
  - id: vitest
    resource: ../../vitest.config.ts
    title: vitest.config.ts
  - id: rules
    resource: ../../.claude/rules/testing.md
    title: Testing conventions
  - id: harness
    resource: ../../scripts/harness.sh
    title: Verification harness
  - id: specs
    resource: ../../src
    title: The .spec.ts files
---

# How to run

| Command | Behaviour |
|---|---|
| `npm test` | one pass, headless Chromium |
| `npm run test:headed` | watch mode — **still headless** |
| `npm run test:coverage` | one pass with coverage |
| `npx ng test --watch=false --include <file>` | one spec file |
| `npx ng test --watch=false --filter "<regex>"` | matching suite/test names |
| `npx ng test --ui` | Vitest UI |
| `bash scripts/harness.sh --test [--include <file>]` | the harness's test layer |

The runner is `@angular/build:unit-test` with `runnerConfig: vitest.config.ts`,
`browsers: ["chromiumHeadless"]`, and `tsconfig.spec.json`.[^ng] `vitest.config.ts` sets
`globals: true` and `environment: 'jsdom'`, but the builder's `browsers` option decides where
tests run: real Chromium, so IndexedDB is real.[^vitest]

Vitest transpiles without type-checking; `tsc -b tsconfig.app.json tsconfig.spec.json` (the
harness's `typecheck` layer) is what type-checks specs.

# Conventions

- `.spec.ts` beside the source file; `describe`/`it`/`expect`/`vi` are globals.
- Component specs use `TestBed` with the standalone component in `imports`, and either a
  stubbed `Store` or `StoreModule.forRoot(reducers)`.
- Suites tied to a spec in `docs/specs/` prefix names with its acceptance-criterion id
  (`[AC19] …`).

# Effect specs

- Use `provideMockActions` with a `Subject<Action>`; stub `Store` with a `select` that returns
  an **observable** (effects call `store.select` while their fields initialise), plus
  `SpreadsheetService` and `{ provide: MatSnackBar, useValue: { open: vi.fn() } }`.
- **Install `log()` first.** Effects and services call it during construction, so a spec
  without it fails with `ReferenceError: log is not defined`. Either `import 'src/logger'` at
  the top, or set `globalThis.log = () => {}` in `beforeEach` and delete it in `afterEach`
  (as `app.effects.spec.ts` and `expenses.service.spec.ts` do).
- Outbox specs use `InMemoryOutboxStorage` (structured-clones in and out) and count completed
  drain passes by wrapping the private `runPass` (`countCompletedPasses`); one suite runs the
  drain against the real IndexedDB storage.
- Real-API suite: `indexed-db-outbox-storage.service.spec.ts` deletes the
  `exp-spsh-outbox` database around each test.

# Coverage

| Area | Specs |
|---|---|
| Row mapping and dates | `expense-row.spec.ts`, `spreadsheet.service.spec.ts` (URLs/verbs, column E, serial round-trip, DST, delete and category ranges), `spreadsheet.service.replay.spec.ts` |
| Helpers | `index.spec.ts` (`isExpenseEqual`, `toMessage`), `classify-write-error.spec.ts`, `service-worker-mode.spec.ts` |
| State | `app.reducers.spec.ts` (`lastError`), `report-failure.spec.ts`, `app.effects.spec.ts` (`showFailureToast$`, `deleteCategory$` row index) |
| Expenses | `expenses.service.spec.ts` (add → outbox, load and online wait, delete window and rollback, reload after `sent$`) |
| Outbox | `outbox.service.spec.ts` (hydration, persist-first add, triggers T1–T5, drain outcomes, notice), `indexed-db-outbox-storage.service.spec.ts` |
| Voice and Gemini | `voice-recorder.service.spec.ts`, `voice-record-button.component.spec.ts`, `expense-recognition.service.spec.ts` (SDK mocked) |
| Security | `security.service.spec.ts` (which token each strategy's `logout()` revokes; `google` stubbed with `vi.stubGlobal`) |
| Components | `expenses-table`, `statistics.container` (animation, month scroll), `dashboard-page.container` (voice button placement, never submits), `outbox-status`, `outbox-failure-notice`; smoke tests for categories, dashboard shell, dialog, local storage, test-perf |

`app.component.spec.ts` is `describe.skip`
([known issues](../constraints/known-issues.md) #13).

Not covered: guards, the interceptor, token acquisition and refresh, `PickerService`, the
setup page, the dashboard form submit and voice-to-expense wiring, and the success paths of
the category effects.
There is no end-to-end testing.

# Rules

`CLAUDE.md`: never delete or overwrite working tests without permission, and run
`bash scripts/harness.sh` after every change ([working agreements](../constraints/working-agreements.md)).
CI runs no tests ([CI](ci-and-deployment.md)).

[^ng]: test target configuration
[^vitest]: vitest.config.ts
