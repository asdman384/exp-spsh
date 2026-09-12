---
type: Playbook
title: Build and run locally
description: The exact local loop for this project - why `npm run serve` is not `ng serve`, and the URL and query flags that matter.
tags: [operations, build, dev-server, playbook]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
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

# Prerequisite

Create `keys.json` at the repo root from `keys.example.json` before the first build. It is
imported at compile time, so **the build fails to resolve without it**
([configuration and secrets](configuration-and-secrets.md)).

On Windows, allow script execution first:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

# The local loop

This project does **not** use `ng serve`. `npm run serve` starts `http-server` over the
`dist/` directory, so the loop is two terminals:[^pkg]

```
# terminal 1 - incremental build into dist/exp-spsh
npx npm run watch

# terminal 2 - static server on port 4200, caching disabled (-c-1)
npx npm run serve
```

Then open **http://localhost:4200/exp-spsh/** — the `exp-spsh` path segment is required
because the server roots at `dist/` while the build writes into `dist/exp-spsh`, and because
the service worker's asset globs assume that path
([PWA](../architecture/pwa-and-service-worker.md)).

The page does **not** live-reload. After a rebuild, refresh manually.

# Production build

```
npm run build          # ng build --configuration=production
```

Output: `dist/exp-spsh`, hashed filenames, budgets enforced (initial 2.5 MB warn / 5 MB
error).[^ng] This is exactly what CI runs
([CI and deployment](ci-and-deployment.md)).

`scripts/harness.sh` runs the same production build with
`--output-path=tmp/harness-dist`, so its output never lands in `dist/exp-spsh` and the harness
can run while the local loop is up.[^harness]

# Useful runtime flags

| URL | Effect |
|---|---|
| `.../#/dashboard` | normal entry (root redirects here) |
| `...?logger=1#/dashboard` | additionally fetches and registers **NgRx StoreDevtools** (dynamically imported, so it is otherwise not downloaded at all) |
| `.../#/playground` | unguarded Angular-features sandbox |

The on-page **log overlay** (the `memory` icon in the corner) is always active regardless of
the flag — it is hard-coded on in `src/logger.ts`. Tap it to expand; it has copy and clear
buttons and records every HTTP request through the interceptor.

# Things that will bite

- **The service worker is enabled in development.** Stale assets after a rebuild are
  expected; unregister the worker in DevTools > Application, or hard-reload.
- **`npm run build` and `npm run watch` share `dist/exp-spsh`.** A production build while the
  watcher runs deletes the dev output and writes a production `index.html` that loads hashed
  bundles (`main-<hash>.js`). The watcher's incremental rebuilds emit only the files it sees
  as changed — `main.js`, never `index.html` — so the page keeps loading the production
  bundle and source edits never appear. Restart `watch` to get a full dev build; restarting
  `serve` changes nothing.
- Google OAuth requires `http://localhost:4200/exp-spsh/` to be a registered redirect URI in
  the Cloud console, or login fails with a redirect_uri mismatch.
- `npm install` re-runs the postinstall patch on `node_modules/@angular/service-worker`;
  installing with `--ignore-scripts` silently produces an iOS-broken worker.

[^pkg]: npm scripts
[^ng]: Build configurations
[^harness]: Verification harness
