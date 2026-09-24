---
type: Playbook
title: Build and run locally
description: The exact local loop for this project - why `npm run serve` is not `ng serve`, and the URL and query flags that matter.
tags: [operations, build, dev-server, playbook]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: pkg
    resource: ../../package.json
    title: npm scripts
  - id: readme
    resource: ../../README.md
    title: README
  - id: ng
    resource: ../../angular.json
    title: Build configurations
  - id: harness
    resource: ../../scripts/harness.sh
    title: Verification harness
---

# Prerequisites

- `keys.json` at the repo root, copied from `keys.example.json` with all four fields. It is
  imported as a module, so a missing file or field fails the build
  ([configuration](configuration-and-secrets.md)).
- `npm install` **with** scripts, so `postinstall` patches the service worker.
- On Windows, `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` may be needed for npm
  shims.

# The local loop

Two terminals; `ng serve` is not used:[^pkg]

```
npm run watch     # incremental development build into dist/exp-spsh
npm run serve     # http-server on :4200 over dist/, caching disabled (-c-1)
```

Open **http://localhost:4200/exp-spsh/**. The path segment is required: the server roots at
`dist/`, and `baseHref` is `/exp-spsh/`, so every asset URL carries it. There is no
live reload; refresh after a rebuild.

# Production build and harness

`npm run build` → `dist/exp-spsh`, hashed filenames, budgets enforced.[^ng] CI runs the same
command.

`bash scripts/harness.sh` runs lint, `tsc -b` over app + specs, a production build into
`tmp/harness-dist`, and the tests; flags `--lint`, `--typecheck`, `--build`, `--test`,
`--include <spec>` select layers. Its build never touches `dist/exp-spsh`, so it can run
alongside the loop.[^harness]

# Runtime flags

| URL | Effect |
|---|---|
| `…/exp-spsh/#/dashboard` | normal entry (root redirects here) |
| `…/exp-spsh/?logger=1#/dashboard` | also loads NgRx StoreDevtools (the query must be before `#`) |
| `…/exp-spsh/#/playground` | unguarded sandbox |

The on-page **log overlay** is always present: tap the `memory` icon at the bottom to slide it
up. It has copy and clear buttons and records every HTTP request.

# Things that bite

- **The service worker is off in development builds**, and the first load of a dev build
  removes a worker left by an earlier build (one automatic reload). Set
  `SERVICE_WORKER_IN_DEV = true` in `src/shared/helpers/service-worker-mode.ts` to test
  offline/update behaviour locally; then stale assets after a rebuild are expected again.
  Serving a production build (`npm run build`) always registers the worker.
- **`npm run build` while `watch` runs** replaces the dev output with a production
  `index.html` that loads `main-<hash>.js`. The watcher never rewrites `index.html`, so edits
  stop appearing; restart `watch`. The harness avoids this by building elsewhere.
- Google OAuth needs `http://localhost:4200/exp-spsh/` registered as a redirect URI.

[^pkg]: npm scripts
[^ng]: Build configurations
[^harness]: Verification harness
