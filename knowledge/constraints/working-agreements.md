---
type: Constraint
title: Working agreements and agent policy
description: The mandatory rules for changing this repository, the tool-permission allow/deny lists, and the sprint-window write policy.
tags: [constraints, process, policy, agents]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: claudemd
    resource: ../../.github/CLAUDE.md
    title: Repository instructions
  - id: policy
    resource: ../../policy/sprint-window.json
    title: policy/sprint-window.json
  - id: settings
    resource: ../../.claude/settings.json
    title: Active tool permissions
  - id: settingscopy
    resource: ../../.claude/settings copy.json
    title: Extended permissions and hook (inactive)
---

# Mandatory rules

Stated as **CRITICAL RULES — MANDATORY** in `.github/CLAUDE.md`:[^claudemd]

1. **Never** delete or overwrite working tests without explicit permission.
2. **Never** delete files without confirmation.
3. **Always** run tests after any code change.
4. **Always** create a git checkpoint before major refactorings.
5. One task at a time — no simultaneous multi-change edits.
6. If unsure, **ask**; do not guess.

Working style: update `CLAUDE.md` and `AGENTS.md` when architecture or infrastructure
changes; update `README.md` when a feature is added or modified.

Detailed guidance lives in `.github/rules/`: [code style](../references/source-map.md),
testing, and development environment.

# Write-scope policy

`policy/sprint-window.json` declares a gating policy `W3-NG-SPRINT-42`:[^policy]

| Field | Value |
|---|---|
| `allowed_write_paths` | `src/` |
| `denied_write_paths` | `angular.json`, `package.json` |
| `allowed_build_configurations` | `development` |
| `approval_required_configurations` | `staging` |
| `not_after` | `2028-08-13T00:00:00.000Z` |
| `approval_owner` | `self` |
| `recovery` | stop the session |

The practical reading: **build and dependency configuration is out of scope for routine
changes**; touching `angular.json` or `package.json` is an explicit, approved decision. Note
that `staging` is not an existing build configuration in `angular.json` — only `production`
and `development` are defined.

# Tool permissions

`.claude/settings.json` (active) allows `npx tsc`, `npx ng lint|test|build`, and
`git status|diff|log`; it denies `git push` and `rm`.[^settings]

`.claude/settings copy.json` is an **inactive, richer variant** kept alongside it: it denies
edits to `angular.json`, `package.json`, and `src/app/app.config.ts`, denies publish/deploy
and force-push commands and reading `.env*`, asks before dependency installs and `git push`,
and registers a `PreToolUse` hook at `${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs`.[^settingscopy]

> That hook script **does not exist** in the repository (`.claude/hooks/` is absent), so
> activating the copy as-is would fail on every Bash/Write/Edit call. Treat the file as a
> design sketch, not a drop-in.

`logs/audit.log` exists but is empty and gitignored — presumably the hook's intended output.

# Practical implications

- Deployment is push-triggered on `master`, and `git push` is denied to agents: **a human
  performs the release step**.
- Because CI runs no tests, rule 3 (always run tests) is the only real verification gate
  ([testing](/operations/testing.md)).
- `rm` is denied; rule 2 says the same thing. Prefer leaving dead code in place and flagging
  it over deleting it.

[^claudemd]: Repository instructions
[^policy]: policy/sprint-window.json
[^settings]: Active tool permissions
[^settingscopy]: Extended permissions and hook (inactive)
