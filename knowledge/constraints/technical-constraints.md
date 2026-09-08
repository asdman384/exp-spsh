---
type: Constraint
title: Technical constraints
description: The non-negotiable technical facts a change has to respect - path coupling, column order, hash routing, strict TypeScript, and bundle budgets.
tags: [constraints, technical, coupling, invariants]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: ngsw
    resource: ../../ngsw-config.json
    title: Service worker path globs
  - id: ng
    resource: ../../angular.json
    title: baseHref and budgets
  - id: tscfg
    resource: ../../tsconfig.json
    title: Strict compiler options
  - id: dev
    resource: ../../.github/rules/development.md
    title: Pitfalls and notes
---

# Hard couplings

| Constraint | Why it exists | What breaks if ignored |
|---|---|---|
| The app must be served under **`/exp-spsh/`** | `ngsw-config.json` asset globs are absolute paths[^ngsw] | the app-shell asset group never matches; the PWA stops working offline |
| **`baseHref: ""` + `HashLocationStrategy`** | GitHub Pages cannot rewrite unknown paths to `index.html`; also allows `file://` serving[^dev] | deep links 404 |
| Spreadsheet **column order A-E is fixed** | hard-coded in `addExpense`, `A1:E{n}` ranges, and `select A,B,C,D,E` | reads and writes silently misalign |
| Rows are **newest-first** | `addExpense` inserts at index 0; delete derives a row index from array position | deletion removes the wrong row |
| The **`data_` prefix and `categories` title** are structural | setup discovery filters on them | existing spreadsheets are no longer recognised |
| **OAuth redirect URI = `origin + pathname`** | built at runtime by both security services | login fails with a redirect_uri mismatch |
| The global **`log()`** must exist before anything runs | `main.ts` imports `./logger` before bootstrap; specs include it via tsconfig | `ReferenceError` in effects, guards, services |
| `google.accounts` must be loaded | security services build their client in the constructor | login is impossible |

# Compiler strictness

`strict: true` plus `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
and **`noPropertyAccessFromIndexSignature`** — the last one is the one that surprises people:
dynamic property access needs typed keys or bracket notation.[^tscfg] Angular's
`strictTemplates`, `strictInjectionParameters`, and `strictInputAccessModifiers` are on, so
templates are type-checked too (this is why `protected` members are used freely in
containers — templates can read them).

Target/module are ES2022 with `useDefineForClassFields: false`, which is what allows the
constructor-parameter-property + field-initialiser ordering these components rely on.

# Bundle budgets

Production build:[^ng]

| Budget | Warning | Error |
|---|---|---|
| initial | 2.5 MB | 5 MB |
| any component style | 2 kB | 60 kB |

The 2 kB per-component style warning is easy to trip on a page with a lot of SCSS.
`StoreDevtools` is deliberately kept behind a runtime flag partly for this reason
([dependency wiring](../architecture/dependency-wiring.md)).

# Environment constraints

- **Windows/PowerShell** is the development platform; execution policy must permit npm shims
  ([toolchain](../systems/toolchain.md)).
- `keys.json` must exist before the first build — the failure mode is a module-resolution
  error, not a runtime warning.[^dev]
- The service worker is enabled in development, so caching confusion is a normal part of the
  local loop.
- `npm install` must run its `postinstall` script, or the iOS service-worker patch is missing
  from the build.

[^ngsw]: Service worker path globs
[^dev]: Pitfalls and notes
[^tscfg]: Strict compiler options
[^ng]: baseHref and budgets
