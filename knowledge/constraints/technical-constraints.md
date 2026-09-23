---
type: Constraint
title: Technical constraints
description: The non-negotiable technical facts a change has to respect - path coupling, column order, hash routing, strict TypeScript, and bundle budgets.
tags: [constraints, technical, coupling, invariants]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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
  - id: row
    resource: ../../src/services/spreadsheet/expense-row.ts
    title: EXPENSE_COLUMNS
  - id: dev
    resource: ../../.claude/rules/development.md
    title: Pitfalls and notes
---

# Hard couplings

| Constraint | Why | If ignored |
|---|---|---|
| Served under **`/exp-spsh/`** | `baseHref` becomes `<base href>` and prefixes every `ngsw.json` URL[^ng] | assets 404; the app does not start offline |
| `ngsw-config.json` globs are **build-output paths** (`/*.js`, not `/exp-spsh/*.js`) | the generator matches output files, then adds `baseHref`[^ngsw] | empty asset groups; no offline start |
| **`HashLocationStrategy`** | GitHub Pages cannot rewrite deep links to `index.html`[^dev] | deep links 404 |
| Spreadsheet columns **A–E in `EXPENSE_COLUMNS` order** | every expense read and write derives from that list[^row] | reads and writes misalign; changing the list breaks existing spreadsheets |
| Rows are **newest-first** | `addExpense` inserts at row 0; delete uses array position as row index | deletion removes the wrong row |
| `data_` prefix and `categories` title | setup discovery filters on them | existing spreadsheets are not recognised |
| OAuth redirect URI = `origin + pathname` | built at runtime by the redirect strategy | `redirect_uri_mismatch` |
| Pre-`#` query params read via `initialUrlParams` | the router drops them on its first redirect | OAuth `code`/`state` are lost |
| Global **`log()`** exists before anything runs | `main.ts` imports `./logger` first; tsconfigs include it; specs install it | `ReferenceError` in effects, guards, services |
| `google.accounts` loaded | security services build their client in the constructor; provided by `src/scripts/client.js` | login impossible |
| `keys.json` has all four fields | imported as a typed module | build fails |

# Compiler strictness

`strict` plus `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, and
**`noPropertyAccessFromIndexSignature`** (index-signature properties need bracket access).[^tscfg]
Angular `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers` are on.
`useDefineForClassFields: false` keeps constructor parameter properties available to field
initialisers, which many components and effects rely on.

# Bundle budgets

| Budget | Warning | Error |
|---|---|---|
| initial | 2.5 MB | 5 MB |
| any component style | 2 kB | 60 kB |

StoreDevtools is a lazy chunk behind `?logger=`, and Material/CDK modules are imported
per component, which keeps datepicker/table/tabs/drag-drop in the lazy dashboard chunk.

# Environment

- Windows/PowerShell development; npm shims may need an execution-policy change
  ([toolchain](../systems/toolchain.md)).
- The service worker is enabled in development.
- `npm install` must run `postinstall` (iOS worker patch).

[^ngsw]: Service worker path globs
[^dev]: Pitfalls and notes
[^tscfg]: Strict compiler options
[^ng]: baseHref and budgets
[^row]: EXPENSE_COLUMNS
