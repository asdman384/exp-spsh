---
type: Constraint
title: Working agreements and agent policy
description: The mandatory rules for changing this repository, the agent tool permissions and hooks, and the sprint-window write policy.
tags: [constraints, process, policy, agents]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: claudemd
    resource: ../../CLAUDE.md
    title: Repository instructions
  - id: rules
    resource: ../../.claude/rules
    title: Code style, development, and testing rules
  - id: policy
    resource: ../../policy/sprint-window.json
    title: policy/sprint-window.json
  - id: settings
    resource: ../../.claude/settings.json
    title: Tool permissions and hooks
  - id: agents
    resource: ../../.claude/agents
    title: Subagent definitions
---

# Mandatory rules

From `CLAUDE.md` (the source of truth; `AGENTS.md` points to it):[^claudemd]

1. **Never** delete or overwrite working tests without explicit permission.
2. **Always** run `bash scripts/harness.sh` after any code change.
3. One task at a time.
4. If unsure, **ask**.
5. Update `CLAUDE.md` and `knowledge/` when architecture, infrastructure, or a feature changes.
   Concept files state current behaviour in the present tense; history goes only in
   `knowledge/log.md`.

Detailed guidance is in `.claude/rules/`: `code-style.md`, `development.md`, `testing.md`.[^rules]

# Tool permissions and hooks

`.claude/settings.json`:[^settings]

- **Deny:** `git push`, `git commit --no-verify`/`-n`, `npm publish`, `npm install -g`,
  `rm -rf`, `Remove-Item -Recurse -Force`, reading or editing `.env` and `keys.json`.
- **Allow:** `bash scripts/harness.sh`, `git status|diff|log|show`, `npm test`,
  `npm run build`, `npm run test:coverage`, `npx ng test|build|version`, `npx tsc`.
- **`PreToolUse` hook** on Bash/PowerShell: `.claude/hooks/deny-git-push.mjs` parses the
  command and denies any form of `git push` (aliases, wrappers, quoting); it fails closed.
  Its tests are `deny-git-push.test.mjs`.
- **`SubagentStop` hook:** runs `bash scripts/harness.sh`.

# Write-scope policy

`policy/sprint-window.json` (`W3-NG-SPRINT-42`):[^policy]

| Field | Value |
|---|---|
| `allowed_write_paths` | `src/` |
| `denied_write_paths` | `angular.json`, `package.json` |
| `allowed_build_configurations` | `development` |
| `approval_required_configurations` | `staging` (not defined in `angular.json`) |
| `not_after` | `2028-08-13T00:00:00.000Z` |
| `approval_owner` / `recovery` | `self` / stop the session |

In practice: build and dependency configuration changes need explicit approval.

# Subagents

`.claude/agents/` defines planner, architect, implementer, tester, reviewer, and orchestrator,
plus the `/orchestrate` command. Their outputs go to `docs/specs/`, `docs/architecture/`,
`docs/reviews/`, and `docs/dod/`.[^agents]

# Practical implications

- Deploys are push-triggered and agents cannot push: **a human releases**.
- CI runs no tests, so the harness is the only verification gate
  ([testing](../operations/testing.md)).

[^claudemd]: Repository instructions
[^rules]: Code style, development, and testing rules
[^policy]: policy/sprint-window.json
[^settings]: Tool permissions and hooks
[^agents]: Subagent definitions
