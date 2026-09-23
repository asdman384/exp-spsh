---
type: System
title: Development toolchain
description: Pinned framework and tooling versions, the builders behind each npm script, and the local platform assumptions.
tags: [system, toolchain, dependencies, versions]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
stale_after: 2026-12-23T00:00:00Z
sources:
  - id: pkg
    resource: ../../package.json
    title: package.json
  - id: tscfg
    resource: ../../tsconfig.json
    title: tsconfig.json
  - id: eslint
    resource: ../../eslint.config.js
    title: ESLint flat config
  - id: dev
    resource: ../../.claude/rules/development.md
    title: Development environment rules
---

# Versions

| Area | Package | Range |
|---|---|---|
| Framework | `@angular/*` incl. CDK/Material | `^22.1.6` |
| State | `@ngrx/store`, `effects`, `entity`, `store-devtools` | `^22.0.1` |
| Reactive | `rxjs` | `~7.8.2` |
| Build | `@angular/build`, `@angular/cli` | `^22.1.8` |
| Language | `typescript` | `~6.0.3` |
| Lint | `eslint` `^10.3.0`, `angular-eslint` `22.5.0`, `typescript-eslint` `8.59.2` | |
| Test | `vitest`, `@vitest/browser-playwright` `^4.1.7`; `jsdom` `^27.0.1` | |
| Types | `@types/gapi`, `gapi.client.sheets-v4`, `gapi.client.oauth2-v2`, `gapi.client.discovery-v1`, `google.accounts`, `google.picker`, `node` | various |
| Static server | `http-server` | `^14.1.1` |

There is no `zone.js`; the app is zoneless.[^pkg] Angular CLI 22 requires Node.js
`>= 22.22.3` (or `>= 24.15.0` / `>= 26.0.0`).

Angular 22 defaults components to `OnPush`, and no component sets `changeDetection`
explicitly.

# TypeScript configuration

`strict` plus `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
`noImplicitReturns`, `noFallthroughCasesInSwitch`; ES2022 target/module,
`moduleResolution: bundler`, `experimentalDecorators`, `useDefineForClassFields: false`,
`resolveJsonModule` (so `keys.json` and `package.json` import directly).[^tscfg] Angular:
`strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`.

Root-absolute imports (`src/shared/models`) work through `rootDir: "."` and
`paths: { "*": ["./*"] }`; there is no `baseUrl`.

Ambient `types`: `vitest/globals`, `gapi`, `gapi.client.oauth2-v2`, `gapi.client.sheets-v4`,
`google.accounts`, `google.picker`, `node`.

# Scripts

| Script | Command | Notes |
|---|---|---|
| `build` | `ng build --configuration=production` | `@angular/build:application` |
| `watch` | `ng build --watch --configuration=development` | incremental dev build |
| `serve` | `npx http-server -p 4200 -c-1 dist/` | **not** `ng serve` |
| `test` | `ng test --watch=false` | `@angular/build:unit-test` + Vitest, `chromiumHeadless` |
| `test:headed` | `ng test --watch=true` | watch mode, still headless |
| `test:coverage` | `ng test --coverage` | |
| `lint` | `ng lint` | `@angular-eslint/builder:lint` over `src/**/*.ts`, `src/**/*.html` |
| `viz` | production build with `--stats-json` + `esbuild-visualizer` | bundle analysis |
| `postinstall` | `node scripts/service-worker-ios-workaround.js` | patches `ngsw-worker.js` |

`scripts/harness.sh` runs lint, `tsc -b tsconfig.app.json tsconfig.spec.json`, a production
build into `tmp/harness-dist`, and the tests ([build and serve](../operations/build-and-serve.md)).

# Lint and format

`eslint.config.js` (flat config) applies ESLint + typescript-eslint + angular-eslint and
relaxes a few rules the older code predates (component selector prefix, `prefer-inject`,
`array-type`, `no-inferrable-types`, `consistent-indexed-object-style`).
`no-explicit-any` stays an error; legitimate uses carry an inline disable with a reason.[^eslint]

Prettier: `printWidth: 120`, single quotes, no trailing commas, semicolons, 2-space indent.
`.editorconfig`: UTF-8, final newline, trimmed whitespace, single quotes in TypeScript.

# Local platform

Development is on **Windows/PowerShell**; npm shims may need:[^dev]

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser   # before work
Set-ExecutionPolicy Restricted                        # after work
```

[^pkg]: package.json
[^tscfg]: tsconfig.json
[^eslint]: ESLint flat config
[^dev]: Development environment rules
