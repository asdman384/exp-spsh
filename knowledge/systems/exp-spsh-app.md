---
type: System
title: exp-spsh web application
description: The deployed artifact itself - what is built, where it runs, and the runtime assumptions it makes about the browser.
tags: [system, app, pwa, deployment]
resource: https://github.com/asdman384/exp-spsh
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: angularjson
    resource: ../../angular.json
    title: Build configuration
  - id: pkg
    resource: ../../package.json
    title: Dependencies and scripts
  - id: index
    resource: ../../src/index.html
    title: index.html
---

# Identity

| | |
|---|---|
| Repository | `asdman384/exp-spsh`, default branch `master` |
| Artifact | static bundle in `dist/exp-spsh` |
| Public URL | GitHub Pages project site, path `/exp-spsh/` |
| Version | `package.json` `version`, shown in the toolbar menu |

# Build output

`@angular/build:application`, `baseHref: "/exp-spsh/"`, output directly in `dist/exp-spsh`
(empty `browser` sub-path).[^angularjson] Global styles: Material `deeppurple-amber` plus
`src/styles.scss`. Global script: `src/scripts/client.js` (vendored Google Identity
Services). Assets: `favicon.ico`, `src/assets`, `manifest.webmanifest`. SCSS include path is
the repo root.

- **Production** (default): `outputHashing: all`; budgets initial 2.5 MB warn / 5 MB error,
  component style 2 kB / 60 kB.
- **Development**: no optimization, source maps, named chunks, and `environment.ts` replaced
  by `environment.development.ts`. The two files contain only `{ production: boolean }`, and
  nothing imports them.

# Runtime assumptions

- Evergreen browser: ES2022, zoneless change detection, optional
  `document.startViewTransition` (guarded).
- `google.accounts` exists at startup — provided by the bundled `client.js`
  ([OAuth](../interfaces/google-oauth.md)).
- `window.log` exists — installed by `src/logger.ts` before bootstrap
  ([dependency wiring](../architecture/dependency-wiring.md)).
- `localStorage` holds parseable JSON ([storage](../interfaces/local-storage.md)); IndexedDB
  and `crypto.randomUUID` enable the [write outbox](../architecture/write-outbox.md)
  (without them `addExpense` always writes live).
- Served under `/exp-spsh/` with hash routing, so no server-side rewrites are needed
  ([PWA](../architecture/pwa-and-service-worker.md)).

# Non-product code

- `SnowComponent` (`src/fun/snow/`) is always in the `AppComponent` template but renders 50
  flakes only on **14 February**.
- `src/modules/playground/**` — an unguarded sandbox at `#/playground`, with its own README.

[^angularjson]: Build configuration
