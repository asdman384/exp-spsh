---
type: Playbook
title: Testing
description: How tests run (Angular's Vitest runner in headless Chromium), what is covered, and the test-writing gotchas.
tags: [operations, testing, vitest, playbook]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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
tests run: real Chromium, so IndexedDB and Web Locks are real.[^vitest]

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
  `NetworkStatusService` (`online$`), `SpreadsheetService`, and
  `{ provide: MatSnackBar, useValue: { open: vi.fn() } }`.
- **Install `log()` first.** Effects call `tap(log)` while the class is constructed, so a spec
  without it fails with `ReferenceError: log is not defined`. Either `import 'src/logger'` at
  the top, or set `globalThis.log = () => {}` in `beforeEach` and delete it in `afterEach`
  (as `app.effects.spec.ts` does).
- Outbox specs use `InMemoryOutboxStorage` (structured-clones in and out) and a pass-through
  `OutboxDrainLock` (`{ run: (work) => work() }`); one suite runs the drain against the real
  IndexedDB storage and lock.
- Real-API suites: `indexed-db-outbox-storage.service.spec.ts` deletes the
  `exp-spsh-outbox` database around each test; `outbox-drain-lock.service.spec.ts` checks
  non-overlap and the fallback via `vi.spyOn(navigator, 'locks', 'get')`.

# Coverage

| Area | Specs |
|---|---|
| Row mapping and dates | `expense-row.spec.ts`, `spreadsheet.service.spec.ts` (URLs/verbs, column E, serial round-trip, DST, delete and category ranges), `spreadsheet.service.replay.spec.ts` |
| Helpers | `index.spec.ts` (`isExpenseEqual`, `toMessage`), `classify-write-error.spec.ts` |
| State | `app.reducers.spec.ts` (`lastError`), `report-failure.spec.ts`, `app.effects.spec.ts` (`showFailureToast$`, delete row-index arithmetic), `app.effects.add-expense.spec.ts` (routing), `outbox.*.spec.ts` |
| Outbox services | IndexedDB storage, drain lock |
| Security | `security.service.spec.ts` (which token each strategy's `logout()` revokes; `google` stubbed with `vi.stubGlobal`) |
| Components | `expenses-table` (inputs/outputs), `statistics.container` (animation, month scroll), `outbox-status`, `outbox-failure-notice`; smoke tests for categories, dashboard shell, dialog, test-perf |

`app.component.spec.ts` is `describe.skip`
([known issues](../constraints/known-issues.md) #13).

Not covered: guards, the interceptor, the security services' token acquisition and refresh, `PickerService`, the setup page,
the dashboard form, and the success paths of the category effects and `loadExpenses$`.
There is no end-to-end testing.

# Rules

`CLAUDE.md`: never delete or overwrite working tests without permission, and run
`bash scripts/harness.sh` after every change ([working agreements](../constraints/working-agreements.md)).
CI runs no tests ([CI](ci-and-deployment.md)).

[^ng]: test target configuration
[^vitest]: vitest.config.ts
