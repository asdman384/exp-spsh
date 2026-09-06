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
    title: The ten .spec.ts files
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

# What is actually covered

| Spec | State | Content |
|---|---|---|
| `src/shared/helpers/index.spec.ts` | **active, 13 tests** | `isExpenseEqual` across every field and date component |
| `src/services/spreadsheet/spreadsheet.service.spec.ts` | **active, 8 tests** | URLs, verbs, and serial-date conversion via `HttpTestingController` |
| `src/modules/dashboard/categories/...spec.ts` | active, 1 test | creation smoke test with a stubbed store |
| `src/modules/dashboard/dashboard.component.spec.ts` | active, 1 test | creation smoke test |
| `src/modules/dashboard/statistics/...spec.ts` | active, 1 test | creation smoke test with a real store |
| `src/shared/components/expenses-table/...spec.ts` | active, 1 test | creation smoke test |
| `src/app/app.component.spec.ts` | **`describe.skip`** | also asserts a title string the app no longer renders |
| `src/services/storage/local-storage.service.spec.ts` | **`describe.skip`** | — |
| `src/shared/components/dialog/dialog.component.spec.ts` | **`describe.skip`** | — |

So the meaningful coverage is **two units**: the expense equality helper and the Sheets
service. Effects, guards, the interceptor, the security services, and the setup flow have no
tests at all. Treat a green run as a regression check on those two units, not as a safety net
for [the flows](/flows/).

# Rules

`.github/CLAUDE.md` states two hard rules that apply here: **never delete or overwrite
working tests without explicit permission**, and **always run tests after any code
change**.[^rules] See [working agreements](/constraints/working-agreements.md).

CI does not run tests — see [CI and deployment](/operations/ci-and-deployment.md).

There is no end-to-end testing configured.

[^ng]: test target configuration
[^vitest]: vitest.config.ts
[^rules]: Testing conventions
