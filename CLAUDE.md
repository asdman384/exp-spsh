# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical rules

- **NEVER** delete or overwrite working tests without explicit permission.
- **NEVER** delete files without confirmation.
- **ALWAYS** run tests after any code change.
- **ALWAYS** create a git checkpoint before a major refactoring.
- One task at a time. Do not make multiple unrelated changes simultaneously.
- If you are unsure — **ASK**, do not guess.
- Update `CLAUDE.md` and `AGENTS.md` when architecture or infrastructure changes; update
  `README.md` when a feature is added or modified.

## Commands

```bash
npm run build          # production build -> dist/exp-spsh
npm run watch          # incremental development build (leave running)
npm run serve          # static server on :4200 over dist/  -- NOT `ng serve`
npm test               # one pass, headless Chromium
npm run test:headed    # watch mode (still headless -- the name means watching, not a visible browser)
npm run test:coverage
```

**Local loop is two terminals**: `npm run watch` in one, `npm run serve` in the other, then
open **http://localhost:4200/exp-spsh/**. The `exp-spsh` path segment is required — the server
roots at `dist/` while the build writes to `dist/exp-spsh`, and the service worker's asset
globs hard-code that path. The page does not live-reload; refresh after a rebuild.

Run a single test file or a single test:

```bash
npx ng test --watch=false --include src/shared/helpers/index.spec.ts
npx ng test --watch=false --filter "isExpenseEqual"     # regex over suite/test names
npx ng test --ui                                        # interactive Vitest UI
```

```bash
npm run lint            # ng lint -- ESLint + angular-eslint over src/**/*.ts and src/**/*.html
npx tsc -b tsconfig.app.json tsconfig.spec.json   # plain TS project-reference build; also
                                                   # type-checks *.spec.ts, which `build` does not
```

`eslint.config.js` relaxes several stock angular-eslint/typescript-eslint rules (component
selector prefix, `prefer-inject`, `array-type`, `no-inferrable-types`,
`consistent-indexed-object-style`) because the existing codebase predates them and fixing every
call site is a dedicated rename/refactor task, not a lint-gate side effect. `no-explicit-any` is
still an error; the handful of legitimate uses (e.g. `HttpInterceptor.intercept`'s `<any>`
signature, `log()`'s variadic args) carry an inline `eslint-disable-next-line` with a reason —
keep that pattern rather than loosening the rule further.

On Windows, `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` may be needed before npm
shims run; hence the `npx npm run <script>` form seen in the README.

## Prerequisite

`keys.json` must exist at the repo root before the first build (copy `keys.example.json`).
It holds `CLIENT_ID`, `API_KEY`, `CLIENT_SECRET` and is **imported as a module**, so a missing
file is a build-time module-resolution failure. CI writes it from repository secrets.

## Architecture

Angular 21 standalone PWA + NgRx 21. **There is no backend**: the user's own Google
Spreadsheet is the database and the browser calls Google APIs directly. The `gapi` client
library is never loaded — only its TypeScript types are used; all traffic goes through
Angular's `HttpClient`.

### Data flow

Containers hold no business logic beyond forms. They dispatch an action and select state;
**every remote read and write lives in an effect** (`src/@state/app.effects.ts`).

```
container --dispatch--> intent action --> effect --> SpreadsheetService --> Google
                                            |
                                            +--> store* action --> reducer --> selectors
```

Intent actions (`load*`, `add*`, `delete*`, `update*`) are **effect-only** — the reducer
ignores them. They terminate in `storeCategories` / `storeExpenses`, which the reducer
applies. There is one feature slice, `app`, hydrated synchronously from `localStorage` at
module load (`app.reducers.ts`).

### The spreadsheet is the schema

Two tab shapes: `categories` (A=name, B=position) and `data_<person>` (A=category,
B=comment, C=amount, D=date, E=in-debt amount). Consequences that shape most of the code:

- **Column order A–E is hard-coded in three places**: `addExpense`, the `A1:E{n}` ranges, and
  the gviz `select A, B, C, D, E`. Changing the layout means changing all three.
- **Rows have no id.** Deletion resolves a *row index* by re-reading and comparing every
  field (`isExpenseEqual`). Row position is the only handle.
- New expenses are **inserted at row 0**, so sheets are newest-first.
- Dates cross the boundary in **two different encodings**: Sheets serial numbers (days since
  1899-12-30) for `values.*`, and `Date(y,m,d,h,mi,s)` strings from gviz.

### Two read paths

`SpreadsheetService` uses the Sheets v4 REST API for writes and category reads, but expense
reads go through the **Google Visualization Query endpoint** (`/gviz/tq`) so filtering happens
server-side. That response is JSONP-shaped text unwrapped with a regex.

### Auth

`AbstractSecurityService` has two implementations; `RedirectSecurityService` is the one bound
in `app.config.ts` (swap the single provider to change strategies). `ExpAuthInterceptor` calls
`refreshToken()` **before every HTTP request** except the token endpoint, making it the single
auth choke point. "Logged in" means a `user` object exists in `localStorage`, not that a token
is valid.

### Things that will surprise you

- **`log()` is a global**, installed by `src/logger.ts` (dynamically imported in `main.ts`
  *before* bootstrap). It is used without import across effects, services, and guards, and
  writes to both the console and an always-on overlay in the page.
- **Every effect swallows errors**: `catchError -> log(e) -> EMPTY`. No error state, no
  failure actions, no toast. A failed operation looks like a spinner that stopped. The log
  overlay is where you debug.
- **The NgRx entity adapter keys sheets by `title`**, so `selectedSheetId` holds a string;
  `Sheet.id` is the numeric Google `gid`. `Category.id` is an ordering *position*, not an id.
- **The service worker is enabled in development too**. Stale assets after a rebuild are
  expected — unregister the worker or hard-reload.
- `npm install` must run `postinstall`, which patches
  `node_modules/@angular/service-worker/ngsw-worker.js` for iOS. `--ignore-scripts` silently
  produces a broken worker.
- Deployment is a GitHub Pages project site under `/exp-spsh/`. That path is encoded in
  `ngsw-config.json` and in the Google OAuth redirect URIs. CI **does not run tests**.

## Conventions

- Root-absolute imports (`src/shared/models`, `src/@state`), enabled by `baseUrl: "./"`.
- Standalone components importing `UIKitModule` wholesale rather than individual Material
  modules; routed ones are named `*.container.ts`.
- Template-driven forms (`ngModel`) throughout — no reactive forms anywhere.
- Constructor injection with `private readonly` params; template-visible members `protected`.
- `exhaustMap` is the default in effects (drop-while-busy); `switchMap` only where a newer
  request should supersede the older one.
- Public service methods carry a JSDoc block linking the Google API reference page they call.
  Keep that habit.

Details: [`.claude/rules/code-style.md`](.claude/rules/code-style.md),
[`.claude/rules/testing.md`](.claude/rules/testing.md),
[`.claude/rules/development.md`](.claude/rules/development.md).

## Knowledge base

`knowledge/` is an OKF v0.2 bundle (markdown + YAML frontmatter) documenting this project in
depth — start at [`knowledge/index.md`](knowledge/index.md). Read the relevant concept before
non-trivial work rather than re-deriving it:

| Question | Concept |
|---|---|
| How does state flow? | `knowledge/architecture/state-management.md` |
| What does this API call do? | `knowledge/interfaces/` |
| How does this feature work end to end? | `knowledge/flows/` |
| What is the sheet layout? | `knowledge/domain/spreadsheet-layout.md` |
| What is already known to be broken? | `knowledge/constraints/known-issues.md` |
| Why is it failing? | `knowledge/operations/troubleshooting.md` |

Every concept cites its source files in frontmatter. The bundle is **unverified** — confirm a
claim against its sources before acting on it irreversibly.

[`docs/backend-less-assessment.md`](docs/backend-less-assessment.md) is a judgement rather
than a description: it evaluates the Sheets-as-backend design and ranks the improvements that
keep it.

## Guards

`git push` is blocked by a `PreToolUse` hook, not merely discouraged:
`.claude/hooks/deny-git-push.mjs` parses every Bash command and denies a push in any form it
can detect statically — git aliases, shell aliases, `bash -c`, `xargs`, `$(...)`, chained
segments, `npm run` scripts. Pushing is a human step. Run
`node .claude/hooks/deny-git-push.test.mjs` after changing the guard; the header of the hook
documents what it deliberately cannot see.

`.claude/settings.json` also enables a `SubagentStop` hook that runs the harness on every
subagent handoff, so an orchestrator gets an independent signal rather than the subagent's
own claim.

## Subagents

`.claude/agents/` defines planner, architect, implementer, tester, reviewer, and orchestrator
roles, plus the `/orchestrate` command. Note that these definitions currently describe a
`backend/` + `frontend/` Python-and-TypeScript layout with `docs/specs/` outputs, none of
which exists here — verify their paths and commands against this repository before relying
on them.
