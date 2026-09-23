---
type: External System
title: GitHub Actions and GitHub Pages
description: The build-and-host system - what triggers a deployment, how secrets become keys.json, and the URL contract Pages imposes.
tags: [system, ci, github-actions, github-pages, hosting]
resource: ../../.github/workflows/webpack.yml
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: wf
    resource: ../../.github/workflows/webpack.yml
    title: build -> deploy gh-pages workflow
---

# The workflow

`.github/workflows/webpack.yml`, named "build -> deploy gh-pages" (the filename is historical;
the build uses esbuild via `@angular/build`).[^wf]

**Triggers:** `push` and `pull_request` on `master`, path-filtered to `src/**`,
`package.json`, `package-lock.json`, `angular.json`, `tsconfig.json`, `ngsw-config.json`, and
the workflow file. Changes only to `scripts/`, `tsconfig.app.json`, `keys.example.json`, or
docs do not trigger a build.

| Job | Steps |
|---|---|
| `build` | checkout → Node 22.x → write `keys.json` → `npm install` → `npm run build` → `upload-pages-artifact` from `dist/exp-spsh` |
| `deploy` | needs `build`; `actions/deploy-pages@v4` to the `github-pages` environment (`pages: write`, `id-token: write`) |

`deploy` has no branch or event condition, so a `pull_request` run also attempts to deploy.
`npm install` (not `npm ci`) runs the `postinstall` iOS service-worker patch
([PWA](../architecture/pwa-and-service-worker.md)).

# Secrets

The build step assembles `keys.json` by shell string concatenation from `CLIENT_ID`,
`API_KEY`, `CLIENT_SECRET`, and `APP_ID`. Only the first three are mapped into the step's
`env`, so **`APP_ID` is written as an empty string** in CI builds
([known issues](../constraints/known-issues.md) #29). The values are compiled into the
published bundle ([security posture](../constraints/security-posture.md)); rotating one means
updating the secret and re-running the workflow.

# The URL contract

A project site is served from `https://<owner>.github.io/<repo>/`. These must change together
if the repository is renamed or becomes a user site:

1. `angular.json` `baseHref` (`/exp-spsh/`) — `<base href>` and every `ngsw.json` URL;
2. the OAuth authorized redirect URIs in the Google console;
3. the local URL `http://localhost:4200/exp-spsh/`.

`ngsw-config.json` globs are relative to the build output and routing is hash-based, so
neither needs to change.

# What CI does not do

No tests, lint, or separate type-check of specs. `npm run build` type-checks the app, so a
type error fails the deploy; a failing test does not ([testing](../operations/testing.md)).

[^wf]: build -> deploy gh-pages workflow
