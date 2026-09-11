---
type: Constraint
title: Code conventions
description: The patterns this codebase actually follows - naming, imports, component style, RxJS idioms - so new code reads like the old.
tags: [constraints, conventions, code-style]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: rules
    resource: ../../.github/rules/code-style.md
    title: Code style guidelines
  - id: src
    resource: ../../src
    title: Observed patterns across the source tree
---

# Naming and file layout

| Kind | Suffix / pattern | Example |
|---|---|---|
| Routed smart component | `*.container.ts`, class `...Container` or `...PageContainer` | `statistics.container.ts` -> `StatisticsContainer` |
| Presentational component | `*.component.ts` | `expenses-table.component.ts` |
| Service | `*.service.ts` | `spreadsheet.service.ts` |
| Barrel | `index.ts` per folder | `src/services/index.ts` |

Selectors are prefixed inconsistently by design era: `app-root`, `app-dashboard`,
`app-snow`, but also `dashboard-page`, `categories-page`, `setup-page`, `login-page`,
`expenses-table`, `exp-dialog`, `exp-statistics-container`. New page containers follow the
unprefixed `*-page` form.

Directory roles are fixed:[^rules]

```
src/@state/           NgRx store, effects, actions, selectors, model
src/app/              root component, config, routes
src/modules/          feature areas (dashboard, setup, playground)
src/services/         API clients and platform services
src/shared/           components, guards, helpers, models
src/constants/        route/UI/storage/spreadsheet constants
src/environments/     build-time environment flags
src/http-interceptors/
src/fun/              seasonal extras
```

# Imports

- **Root-absolute imports** (`src/shared/models`, `src/@state`, `src/constants`), enabled by
  `baseUrl: "./"`. Relative imports are used only within a folder or for `keys.json`.
- Always import from the barrel (`src/services`), not the deep path, except where a barrel
  would create a cycle (`app.effects.ts` imports `./app.actions` directly).

# Components

- **Standalone**, with an `imports: [...]` array listing only the specific Material/CDK
  modules and `@angular/common` pipes/directives (`AsyncPipe`, `DatePipe`, `NgClass`) that
  component's own template uses — there is no shared UI-kit barrel module (see
  [dependency wiring](../architecture/dependency-wiring.md)).
- Templates in separate `.html` files, styles in `.scss` — except very small components
  (`SetupComponent`, `LoginPageContainer`) which inline both.
- **Constructor injection** with `private readonly` parameter properties is the dominant
  style; `inject()` appears only in newer code (`ExpensesTableComponent`,
  `PlaygroundComponent`) and in functional guards.
- Template-visible members are `protected readonly`; observables end in `$`.
- `ChangeDetectionStrategy.OnPush` on `DashboardPageContainer` and `ExpensesTableComponent`
  only; other containers use default change detection.
- Control flow uses the **new block syntax** (`@if`, `@for`, `@empty`) with explicit `track`.
- Forms are **template-driven** (`FormsModule`, `ngModel`, `#form="ngForm"`) throughout —
  there is no reactive-forms usage anywhere.

# RxJS idioms

- `store.select(...)` piped into the template with `async`; `combineLatest({...})` for a
  single `pageState$` object (see `AppComponent`).
- `first()` / `take(1)` for one-shot reads in constructors.
- Effects use `exhaustMap` as the default (drop-while-busy), `switchMap` only where a newer
  request should supersede the old one.
- `takeUntilDestroyed()` for subscriptions in components.
- Side effects go in `tap(...)`; `tap(log)` is the standard first operator in every effect.

# Styling

SCSS everywhere (enforced by schematics config), Angular Material `deeppurple-amber`
prebuilt theme, Prettier at 120 columns with single quotes and no trailing commas.

# Documentation

Public service methods carry a JSDoc block whose first lines are **links to the Google API
reference pages** they call. Keep that habit — it is the fastest route from code to the
upstream contract.

Comments are sparse and in English, except a few Russian-language comments in `main.ts` and
`app.config.ts`.

[^rules]: Code style guidelines
