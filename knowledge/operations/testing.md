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
    resource: ../../scripts/harness.mjs
    title: Verification harness
  - id: specs
    resource: ../../src
    title: The .spec.ts files
  - id: playwright
    resource: ../../playwright.config.ts
    title: Playwright browser test configuration
  - id: e2e
    resource: ../../e2e/README.md
    title: Browser test setup and conventions
---

# How to run

| Command                                              | Behaviour                       |
| ---------------------------------------------------- | ------------------------------- |
| `npm test`                                           | one pass, headless Chromium     |
| `npm run test:headed`                                | watch mode — **still headless** |
| `npm run test:coverage`                              | one pass with coverage          |
| `npx ng test --watch=false --include <file>`         | one spec file                   |
| `npx ng test --watch=false --filter "<regex>"`       | matching suite/test names       |
| `npx ng test --ui`                                   | Vitest UI                       |
| `node scripts/harness.mjs --test [--include <file>]` | the harness's test layer        |

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

| Area                      | Specs                                                                                                                                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row mapping and dates     | `expense-row.spec.ts`, `spreadsheet.service.spec.ts` (URLs/verbs, column E, serial round-trip, DST, delete and category ranges), `spreadsheet.service.replay.spec.ts`                                                                                                 |
| Helpers                   | `index.spec.ts` (`isExpenseEqual`, `toMessage`), `classify-write-error.spec.ts`, `service-worker-mode.spec.ts`                                                                                                                                                        |
| State                     | `app.reducers.spec.ts` (`lastError`), `report-failure.spec.ts`, `app.effects.spec.ts` (`showFailureToast$`, `deleteCategory$` row index)                                                                                                                              |
| Expenses                  | `expenses.service.spec.ts` (add → outbox, load and online wait, delete window and rollback, reload after `sent$`)                                                                                                                                                     |
| Outbox                    | `outbox.service.spec.ts` (hydration, persist-first add, triggers T1–T5, drain outcomes, notice), `indexed-db-outbox-storage.service.spec.ts`                                                                                                                          |
| Dashboard form and totals | `dashboard-page.container.spec.ts`, `dashboard-page.view-model.spec.ts`, `parse-amount.spec.ts` (submit/reset, dates, gestures, queued rows, totals, decimal and addition parsing)                                                                                    |
| Statistics                | `statistics-summary.spec.ts`, `statistics-data.service.spec.ts`, `statistics.container.spec.ts` (category comparisons, debt, January rollover, obsolete reads, reconnect, drill-down)                                                                                 |
| Receipts                  | `receipt-recognition.spec.ts`, `dashboard-receipt.spec.ts`, `receipt-photo-button.component.spec.ts`, `receipt-review.component.spec.ts` (validation, confirmation, cancellation, context, dialog, editing)                                                           |
| Voice and Gemini          | `voice-recorder.service.spec.ts`, `voice-record-button.component.spec.ts`, `expense-recognition.service.spec.ts` (SDK mocked)                                                                                                                                         |
| Setup                     | `setup-page.container.spec.ts` (creation/Picker, tab sequence/reuse, drafts, validation, sequential writes, lost-response recovery, read errors, guards, details, category state before navigation); `spreadsheet.service.spec.ts` (creation request/response/errors) |
| Security                  | `security.service.spec.ts` (which token each strategy's `logout()` revokes; `google` stubbed with `vi.stubGlobal`)                                                                                                                                                    |
| Components                | `expenses-table`, `statistics.container` (animation, month scroll), `dashboard-page.container` (voice button placement, never submits), `outbox-status`, `outbox-failure-notice`; smoke tests for categories, dashboard shell, dialog, local storage, test-perf       |

`app.component.spec.ts` is `describe.skip`
([known issues](../constraints/known-issues.md) #13).

Not covered: guards, the interceptor, token acquisition and refresh, `PickerService`, the
success paths of the category effects. Dashboard specs cover submit,
reset, and voice-to-expense wiring; test presence does not establish that the suite passes.

# End-to-end tests

All Playwright projects use Google Chrome Stable with a 425 × 896 CSS pixel
viewport, mobile layout, and touch input. `npm run e2e` builds the
production app in `tmp/e2e-dist/exp-spsh` and manages a static server on port 4300.
`E2E_BASE_URL` selects an existing app server and skips the build and local server.
The URL includes the `/exp-spsh/` base path and a trailing slash.

`e2e/pages` holds page objects. `e2e/fixtures/test.ts` provides typed, test-scoped
page objects. `e2e/tests` holds scenarios and assertions. The signed-out test uses
an empty storage state, opens the root URL, and checks the login redirect, page
title, and visible, enabled sign-in button. It does not use a Google account.

`npm run e2e:auth` runs the authenticated project. Its setup dependency
reads test account tokens from the ignored `e2e/google-tokens.local.json`.
It checks the access token with Google and uses the app refresh flow when needed.
Each authenticated test loads the verified state from
`tmp/playwright-auth/google.json` in its own context.

During E2E work, do not run `scripts/harness.mjs`, or `npm run harness`.
Use focused Playwright tests, `npx tsc -p tsconfig.e2e.json`, and ESLint instead.
The harness lints and type-checks E2E files when it runs for other work. Browser scenarios run separately with
`npm run e2e`. `npm run e2e:headed` opens Chrome; `npm run e2e:ui` opens Playwright
UI mode. `npm run e2e:report` opens the HTML report. Failure artifacts and reports
are under ignored `tmp/`. Setup, extension rules, and CI commands are in
[the E2E guide](../../e2e/README.md).

`npm run e2e:auth -- spending.spec.ts` uses the existing test spreadsheet
identified by `spreadsheetId`, `categoriesSheetId`, and `dataSheetId` in the
private E2E config. The test checks both tab IDs against their titles, restores
the selection in its own browser context, and opens the dashboard. It adds an
expense for today in Europe/Warsaw using an existing category and a unique
comment. It verifies persistence after a reload, deletes the matching row with
a rightward drag, and checks the deletion after another reload.
The offline spending scenario disconnects after loading a category, checks the
pending row, reconnects, and checks for one saved row after a reload. Both
scenarios match the spreadsheet ID, data tab and expense query on reload. A
test-scoped fixture removes rows with the exact test comment during teardown.
The authenticated project uses a single worker for the shared test spreadsheet.
With `--headed`, the online spending test calls `page.pause()` on the dashboard
before it adds the expense. Playwright Inspector lets the user step through
actions or resume execution. Headless runs do not pause.

`npm run e2e:auth -- categories.spec.ts` checks category creation, duplicate
names, swipe deletion, and drag reordering on the same test spreadsheet.
The tests compare the category list from Sheets after a reload and check the
visible rows. Teardown removes the categories created by each test.

# Rules

`CLAUDE.md`: never delete or overwrite working tests without permission, and run
`node scripts/harness.mjs` after code changes except during E2E work ([working agreements](../constraints/working-agreements.md)).
CI runs no tests ([CI](ci-and-deployment.md)).

[^ng]: test target configuration

[^vitest]: vitest.config.ts
