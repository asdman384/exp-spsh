---
type: Constraint
title: Code conventions
description: The patterns this codebase actually follows - naming, imports, component style, RxJS idioms - so new code reads like the old.
tags: [constraints, conventions, code-style]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: rules
    resource: ../../.claude/rules/code-style.md
    title: Code style guidelines
  - id: src
    resource: ../../src
    title: Observed patterns across the source tree
---

`.claude/rules/code-style.md` is the prescriptive guide;[^rules] this page records what the
code actually does, including where it predates that guide.

# Naming and layout

| Kind | Pattern | Example |
|---|---|---|
| Routed smart component | `*.container.ts`, class `…Container` / `…PageContainer` | `statistics.container.ts` → `StatisticsContainer` |
| Presentational component | `*.component.ts` | `expenses-table.component.ts` |
| Service | `*.service.ts` | `spreadsheet.service.ts` |
| Barrel | `index.ts` per folder | `src/services/index.ts` |

Selectors are mixed (`app-root`, `dashboard-page`, `exp-statistics-container`,
`outbox-status`); the lint rule is off. New page containers use the unprefixed `*-page` form.

```
src/@state/            NgRx actions, reducers, effects, selectors, models
src/app/               root component, config, routes
src/modules/           feature areas: dashboard, setup, playground
src/services/          Google clients, security, storage, outbox, network
src/shared/            components, guards, helpers, models
src/constants/         route, UI, storage-key, spreadsheet constants
src/http-interceptors/ ExpAuthInterceptor
src/fun/               seasonal extras
```

# Imports

- Root-absolute (`src/shared/models`, `src/@state`), via `paths: { "*": ["./*"] }`. Relative
  imports only within a folder and for `keys.json` / `package.json`.
- Import from barrels, except to avoid cycles (e.g. `outbox-storage.ts` ↔
  `indexed-db-outbox-storage.service.ts` use `import type`).

# Components

- Standalone, with an `imports` array listing only what the template uses; no shared UI-kit
  module.
- `OnPush` by default (Angular 22); nothing sets `changeDetection`.
- Separate `.html`/`.scss` files, except small components with inline templates
  (`SetupComponent`, `LoginPageContainer`, `OutboxStatusComponent`,
  `OutboxFailureNoticeComponent`).
- `input()`/`output()`/`viewChild()` signal APIs (no decorator inputs).
- Constructor injection with `private readonly` parameters dominates (`prefer-inject` lint is
  off); `inject()` appears in `OutboxEffects`, `StatisticsContainer`, the outbox components,
  `PlaygroundComponent`, and the functional guards.
- Template-visible members are `protected`; observables end in `$`.
- Block control flow (`@if`, `@for` with `track`, `@empty`).
- Forms: the dashboard uses **Signal Forms** (`form()`, `required()`, `[formField]`);
  categories and setup use template-driven `ngModel`.

# RxJS and NgRx idioms

- `store.select(...)` + `async` pipe; `AppComponent` combines everything into one
  `pageState$`.
- `first()` / `take(1)` for one-shot reads in constructors; `takeUntilDestroyed()` for
  component subscriptions.
- Effects start with `tap(log)`; remote effects use `exhaustMap` and put `catchError` on the
  inner observable, reporting via `reportFailure`.
- Optimistic effects snapshot state in a `Memento` for rollback.

# Styling and comments

SCSS (schematics default), Material `deeppurple-amber`, Prettier at 120 columns with single
quotes and no trailing commas.

Public `SpreadsheetService` methods start their JSDoc with a link to the Google API reference
they call — keep that habit. Newer code cites the `docs/specs/` decision (`D3`, `AC19`) it
implements.

[^rules]: Code style guidelines
