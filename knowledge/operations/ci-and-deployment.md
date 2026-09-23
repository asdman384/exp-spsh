---
type: Playbook
title: CI and deployment
description: How a change reaches production, what the pipeline does and does not check, and the manual steps around a release.
tags: [operations, ci, deployment, github-actions, playbook]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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
  -> build:  checkout | node 22 | write keys.json | npm install | npm run build | upload dist/exp-spsh
  -> deploy: actions/deploy-pages@v4 -> github-pages environment
```

Triggers, the path filter, and secrets are in [the GitHub system record](../systems/github-pages.md).

# Release checklist

1. Bump `version` in `package.json` — the only user-visible release marker.[^pkg]
2. Run `bash scripts/harness.sh` locally; CI runs no tests or lint.
3. Merge to `master`; check the change matches the path filter.
4. Watch the `deploy` job.
5. Installed PWAs get `VERSION_READY` and show an update badge
   ([offline and updates](../flows/offline-and-updates.md)); a hard reload is faster.

# Rollback

No rollback action exists. Revert on `master` and let the workflow redeploy, or re-run an
older successful run. Installed PWAs switch versions only when their worker fetches the new
`ngsw.json`, so any deploy propagates gradually.

# Gaps

- No test, lint, or spec type-check in CI; `npm run build` type-checks the app only.
- `npm install`, not `npm ci`: the lockfile is not strictly enforced.
- `deploy` is not guarded to `push`/`master`, so pull-request runs also reach it.
- `APP_ID` is not passed to the build step, so deployed builds have an empty `APP_ID`
  ([known issues](../constraints/known-issues.md) #29).

[^pkg]: version field
