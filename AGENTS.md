# AGENTS.md

Guidance for any coding agent working in this repository.

> **Source of truth is [`CLAUDE.md`](CLAUDE.md).** This file carries only what an agent needs
> before it reads anything else; everything below is deliberately duplicated from there.
> When they disagree, `CLAUDE.md` wins — and update both.

## Hard rules

- **NEVER** delete or overwrite working tests without explicit permission.
- **NEVER** delete files without confirmation.
- **ALWAYS** run tests after any code change.
- **ALWAYS** create a git checkpoint before a major refactoring.
- One task at a time. If you are unsure — ask, do not guess.
- Update `CLAUDE.md` and `AGENTS.md` on architectural or infrastructural change; update
  `README.md` when a feature changes.

## Commands

```bash
npm run build          # production build -> dist/exp-spsh  (also the type-check)
npm run watch          # incremental dev build (terminal 1)
npm run serve          # static server on :4200 over dist/  (terminal 2) -- NOT `ng serve`
npm test               # one pass, headless Chromium
npx ng test --watch=false --include src/shared/helpers/index.spec.ts   # single file
npx ng test --watch=false --filter "isExpenseEqual"                    # single test
```

App URL is **http://localhost:4200/exp-spsh/** — the path segment is required. No live reload.
There is no lint or typecheck script. `keys.json` must exist at the repo root before building.

## What this project is

An Angular 21 + NgRx standalone PWA for expense tracking with **no backend** — the user's own
Google Spreadsheet is the database, called directly from the browser.

Read these before non-trivial work:

1. [`CLAUDE.md`](CLAUDE.md) — architecture, data flow, and the traps that are not obvious from
   any single file (global `log()`, swallowed errors, positional row addressing, two read
   paths, two date encodings).
2. [`knowledge/index.md`](knowledge/index.md) — an OKF v0.2 knowledge bundle covering the
   architecture, domain, flows, interfaces, systems, operations, and known issues in depth.
   Check `knowledge/constraints/known-issues.md` before reporting a bug as new.
3. [`.claude/rules/`](.claude/rules/) — code style, testing, and development environment.

## Scope limits

`policy/sprint-window.json` declares the write policy in force: writes are expected within
`src/`, and `angular.json` and `package.json` are **denied** — changing build or dependency
configuration is an explicit, approved decision, not a routine edit.

Do not run `git push`; deployment happens on push to `master` and is a human step. This is
enforced, not just requested: a `PreToolUse` hook (`.claude/hooks/deny-git-push.mjs`) parses
every Bash command and denies a push in any form it can detect — aliases, wrappers, chained
segments, command substitution.
