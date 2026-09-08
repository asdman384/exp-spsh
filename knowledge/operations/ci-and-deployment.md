---
type: Playbook
title: CI and deployment
description: How a change reaches production, what the pipeline does and does not check, and the manual steps around a release.
tags: [operations, ci, deployment, github-actions, playbook]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: wf
    resource: ../../.github/workflows/webpack.yml
    title: build -> deploy gh-pages workflow
  - id: pkg
    resource: ../../package.json
    title: version field
---

# Pipeline

```
push to master (path-filtered)
  -> build job:  checkout | node 22 | write keys.json from secrets | npm install | npm run build
                 | upload-pages-artifact  dist/exp-spsh
  -> deploy job: actions/deploy-pages@v4  ->  github-pages environment
```

Details and the path filter are in [the GitHub system record](../systems/github-pages.md).

# Release checklist

1. **Bump `version` in `package.json`.** It is displayed in the toolbar menu and is the only
   user-visible release marker.[^pkg] Nothing bumps it automatically.
2. Run `npm test` locally — **CI does not run tests**, so this is the only gate.
3. Merge to `master`. Confirm the workflow's path filter matches your change; edits confined
   to `scripts/`, `README.md`, `.github/rules/`, or `keys.example.json` will **not** trigger
   a deploy.
4. Watch the `deploy` job and the `github-pages` environment for the published URL.
5. Verify in the browser: existing installs pick up the new version through
   `VERSION_READY` and show an update badge
   ([offline and updates](../flows/offline-and-updates.md)); a hard reload is the fast path.

# Rollback

There is no rollback action. Options, in order of preference:

1. Revert the commit on `master` and let the workflow redeploy (the pattern already used —
   see commit `3075d41`, a revert of `98f2b23`).
2. Re-run an older successful workflow run from the Actions UI to republish its artifact.

Users on an installed PWA keep the previous version until the worker fetches the new
`ngsw.json`, so a bad deploy propagates gradually rather than instantly.

# Secrets

`API_KEY`, `CLIENT_ID`, `CLIENT_SECRET` are repository secrets, concatenated into `keys.json`
at build time. Rotating any of them requires updating the secret **and** re-running the
workflow, because the values are baked into the bundle
([configuration and secrets](configuration-and-secrets.md)).

# Gaps to be aware of

- No test, lint, or type-check step in CI. `npm run build` does type-check the app, so a
  type error still fails the build — but a failing unit test does not.
- `npm install` (not `npm ci`) means the lockfile is not strictly enforced in CI.
- Pull requests trigger the `build` job (the path filter includes `pull_request`), but the
  `deploy` job only makes sense on `master`; it is not branch-guarded, so review the workflow
  before adding new triggers.

[^pkg]: version field
