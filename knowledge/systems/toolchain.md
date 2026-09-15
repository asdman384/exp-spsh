---
type: System
title: Development toolchain
description: Pinned framework and tooling versions, the builders behind each npm script, and the local platform assumptions.
tags: [system, toolchain, dependencies, versions]
status: stable
generated: { by: claude_code/claude-sonnet-5, at: 2026-09-15T00:00:00Z }
stale_after: 2026-12-15T00:00:00Z
sources:
  - id: pkg
    resource: ../../package.json
    title: package.json
  - id: tscfg
    resource: ../../tsconfig.json
    title: tsconfig.json
  - id: dev
    resource: ../../.github/rules/development.md
    title: Development environment rules
---

# Versions

| Area | Package | Version range |
|---|---|---|
| Framework | `@angular/*` | `^22.1.6` (CDK/Material `^22.1.6`) |
| State | `@ngrx/store`, `effects`, `entity`, `store-devtools` | `^22.0.1` |
| Reactive | `rxjs` | `~7.8.2` |
| Zones | `zone.js` | `~0.15.0` |
| Build | `@angular/build`, `@angular/cli` | `^22.1.8` |
| Language | `typescript` | `~6.0.3` |
| Test | `vitest`, `@vitest/browser-playwright` | `^4.1.7` |
| Test env | `jsdom` | `^27.0.1` |
| Types | `@types/gapi`, `gapi.client.sheets-v4`, `gapi.client.oauth2-v2`, `gapi.client.discovery-v1`, `google.accounts`, `node` | various |
| Dev server | `http-server` | `^14.1.1` |

Angular and NgRx major versions move together; this repo has already gone through
`ng update` 19 -> 20 -> 21 -> 22 (commits `6fda6a8`, `4424e0f`, and the 21->22 pass which
also required Node.js `>= 22.22.3` / `>= 24.15.0` / `>= 26.0.0` — Angular CLI 22 raised its
minimum).[^pkg]

Angular 22 made `OnPush` the default `changeDetection` for components that don't set it
explicitly; every component in `src/` sets `ChangeDetectionStrategy.OnPush` explicitly anyway
(the project's own convention predates this default), so nothing changed behaviorally.

# TypeScript configuration

`strict: true` plus `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
`noImplicitReturns`, `noFallthroughCasesInSwitch`. Target and module are **ES2022**,
`moduleResolution: bundler`, `experimentalDecorators: true`,
`useDefineForClassFields: false`, and `resolveJsonModule: true` — the last one is what lets
`keys.json` and `package.json` be imported directly.[^tscfg]

Angular compiler options: `strictTemplates`, `strictInjectionParameters`,
`strictInputAccessModifiers`.

`baseUrl: "./"` with `rootDir: "."` is why imports are written as absolute-from-root
(`src/shared/models`) rather than relative — the dominant import style in this codebase.
TypeScript 6.0 deprecated `baseUrl` (removal planned for 7.0), but this project still relies
on it for that bare-import style with no `paths` map, so the deprecation is silenced with
`"ignoreDeprecations": "6.0"` rather than dropping `baseUrl` — removing it breaks every
absolute-from-root import project-wide.

Ambient `types` are declared globally: `vitest/globals`, the four `gapi`/`google.accounts`
type packages, and `node`.

# Scripts and their builders

| Script | Command | Builder / tool |
|---|---|---|
| `build` | `ng build --configuration=production` | `@angular/build:application` |
| `watch` | `ng build --watch --configuration=development` | same, incremental |
| `serve` | `npx http-server -p 4200 -c-1 dist/` | **not** `ng serve` — a static server over the build output |
| `test` | `ng test --watch=false` | `@angular/build:unit-test` + vitest runner, `chromiumHeadless` |
| `test:headed` | `ng test --watch=true` | same, watch mode (still headless) |
| `test:coverage` | `ng test --coverage` | same, with coverage |
| `postinstall` | `node scripts/service-worker-ios-workaround.js` | patches ngsw-worker.js in `node_modules` |

See [build and serve](../operations/build-and-serve.md) for how `watch` + `serve` combine.

# Local platform

Development happens on **Windows with PowerShell**. The README and the development rules
both note the execution-policy dance needed to run npm shims:[^dev]

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser   # before work
Set-ExecutionPolicy Restricted                        # after work
```

which is also why commands are frequently written as `npx npm run <script>`.

Formatting is Prettier (`printWidth: 120`, single quotes, no trailing commas, semicolons,
2-space indent) with `.editorconfig` enforcing UTF-8, LF-agnostic final newlines, and
`quote_type = single` for TypeScript. **No ESLint configuration exists** in the repo,
despite `ng lint` appearing in the allowed-commands list.

[^pkg]: package.json
[^tscfg]: tsconfig.json
[^dev]: Development environment rules
