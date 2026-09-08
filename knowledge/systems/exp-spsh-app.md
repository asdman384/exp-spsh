---
type: System
title: exp-spsh web application
description: The deployed artifact itself - what is built, where it runs, and the runtime assumptions it makes about the browser.
tags: [system, app, pwa, deployment]
resource: https://github.com/asdman384/exp-spsh
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
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
| Repository | `asdman384/exp-spsh` (git remote `origin`, default branch `master`) |
| Artifact | static bundle in `dist/exp-spsh` |
| Public URL | GitHub Pages project site, path `/exp-spsh/` |
| Version | `package.json` `version`, shown in the toolbar menu |

# Build output

`@angular/build:application` builder with `baseHref: ""`, `outputPath.base: dist/exp-spsh`
and an empty `browser` sub-path (files land directly in `dist/exp-spsh`).[^angularjson]
Global styles are the Material `deeppurple-amber` prebuilt theme plus `src/styles.scss`;
`src/scripts/client.js` is injected as a global script; assets are `favicon.ico`,
`src/assets`, and `manifest.webmanifest`. `stylePreprocessorOptions.includePaths` is the
repo root, so SCSS can `@use` paths relative to it.

Production adds `outputHashing: all` and enforces budgets: **initial 2.5 MB warning / 5 MB
error**, any component style 2 kB / 60 kB. Development flips `optimization` off, enables
source maps and named chunks, and file-replaces `environment.ts` with
`environment.development.ts` (the two files differ only in the `production` flag; both
environments are otherwise identical and the `SCOPES` constant in them is unused).

# Runtime assumptions

- **Modern evergreen browser.** Target ES2022, zone.js change detection, and optional use of
  `document.startViewTransition` (guarded, with a console warning fallback).
- **The `google.accounts` global exists** before a security service is constructed
  ([OAuth interface](../interfaces/google-oauth.md)).
- **`window.log` exists** — installed by the dynamically imported `src/logger.ts` before
  bootstrap ([dependency wiring](../architecture/dependency-wiring.md)).
- `localStorage` is available and parseable ([storage](../interfaces/local-storage.md)).
- Served under `/exp-spsh/`, because the service worker asset globs hard-code that path
  ([PWA](../architecture/pwa-and-service-worker.md)).
- Hash routing, so the app also works when the host cannot rewrite unknown paths to
  `index.html` — which is exactly the GitHub Pages constraint.

# Seasonal easter egg

`SnowComponent` is always in the `AppComponent` template but enables itself only when the
date is **14 February** (`getMonth() === 1 && getDate() === 14`), rendering 50 randomised
flakes. Harmless, but it explains an unexpected visual on that day.

# Non-product code shipped in the repo

- `src/modules/playground/**` — an unguarded Angular-features sandbox at `#/playground`,
  documented in its own README.
- `test.ts` at the repo root — a scratch iterator experiment, not referenced by any config.

[^angularjson]: Build configuration
