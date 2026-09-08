---
type: External System
title: GitHub Actions and GitHub Pages
description: The build-and-host system - what triggers a deployment, how secrets become keys.json, and the URL contract Pages imposes.
tags: [system, ci, github-actions, github-pages, hosting]
resource: ../../.github/workflows/webpack.yml
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: wf
    resource: ../../.github/workflows/webpack.yml
    title: build -> deploy gh-pages workflow
---

# The workflow

`.github/workflows/webpack.yml`, named **"build -> deploy gh-pages"** (the filename is a
leftover; there is no webpack in this project — Angular uses esbuild via
`@angular/build`).[^wf]

**Triggers:** `push` and `pull_request` on `master`, **path-filtered** to `src/**`,
`package.json`, `package-lock.json`, `angular.json`, `tsconfig.json`, `ngsw-config.json`, and
the workflow file itself.

> A change to `ngsw-config.json` triggers a build, but a change to `scripts/`,
> `keys.example.json`, or `tsconfig.app.json` does **not** — edits there ship only when
> something else in the filter changes.

**Jobs:**

| Job | Steps |
|---|---|
| `build` | checkout -> setup-node 22.x -> compose `keys.json` from secrets -> `npm install` -> `npm run build` -> `upload-pages-artifact` from `dist/exp-spsh` |
| `deploy` | needs `build`; `actions/deploy-pages@v4` into the `github-pages` environment with `pages: write` and `id-token: write` |

`npm install` (not `ci`) runs the `postinstall` iOS service-worker patch, which is required
for a correct production bundle ([PWA](../architecture/pwa-and-service-worker.md)).

# Secrets

`keys.json` is assembled inline by shell string concatenation from three repository secrets:
`API_KEY`, `CLIENT_ID`, `CLIENT_SECRET`. The file is never committed (it is gitignored) but
its contents are **compiled into the published bundle** — see
[security posture](../constraints/security-posture.md).

Rotating a key means updating the GitHub secret and re-running the workflow; there is no
runtime configuration.

# The URL contract

A GitHub Pages *project* site is served from `https://<owner>.github.io/<repo>/`, so the app
lives under `/exp-spsh/`. Three places encode that path and must move together if the
repository is renamed or the site becomes a user site:

1. `ngsw-config.json` asset globs (`/exp-spsh/...`);
2. the OAuth authorized redirect URIs in the Google console;
3. the local serving instructions (`http://localhost:4200/exp-spsh/`).

`baseHref` is empty and routing is hash-based, so `index.html` itself needs no path change —
which is why this coupling is easy to miss.

# What CI does not do

**The workflow never runs tests or a lint step.** `npm test` exists but is not wired into
CI, so a red test suite still deploys ([testing](../operations/testing.md)).

[^wf]: build -> deploy gh-pages workflow
