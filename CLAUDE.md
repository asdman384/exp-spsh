# CLAUDE.md

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## Critical rules

- **ALWAYS** use ASD-STE100 Simplified Technical English.
- **NEVER** delete or overwrite working tests without explicit permission.
- Run `node scripts/harness.mjs` after code changes, except during E2E work.
- during E2E work use focused Playwright, lint, and TypeScript checks instead.
- One task at a time.
- If you are unsure — **ASK**, do not guess.
- Update `knowledge/` when architecture or infrastructure changes or a feature is added or modified.
- when update the `knowledge/` rewrote each as a plain present-tense statement of current behaviour. Concept files should describe only the system as it is now. The `knowledge/log.md` is the only place change history belongs.

## Commands

```bash
npm run harness        # lint + typecheck + production build + tests (native on Windows too)
npm run format         # format JS (including MJS/CJS), TS, HTML, CSS, and SCSS
npm run format:check   # check formatting without writing files
npm run build          # production build -> dist/exp-spsh
npm run watch          # incremental development build (leave running)
npm run serve          # static server on :4200 over dist/  -- NOT `ng serve`
npm test               # one pass, headless Chromium
npm run test:headed    # watch mode (still headless -- the name means watching, not a visible browser)
npm run test:coverage
npm run e2e             # Playwright in Google Chrome at 425 × 896; builds and serves on :4300
npm run e2e:ui          # Playwright UI mode
```

**Local loop is two terminals**: `npm run watch` in one, `npm run serve` in the other, then
open **http://localhost:4200/exp-spsh/**. The `exp-spsh` path segment is required — the server
roots at `dist/` while the build writes to `dist/exp-spsh`, and `angular.json` sets
`baseHref: "/exp-spsh/"`, so every asset URL (including those in the generated `ngsw.json`)
carries that prefix. The page does not live-reload; refresh after a rebuild.

`scripts/harness.mjs` builds production into `tmp/harness-dist` (gitignored), never
`dist/exp-spsh`, so running it does not disturb the watch loop.
Run it with `node scripts/harness.mjs` on Windows, Linux, or macOS; no Bash or WSL
is needed. With the npm alias, pass flags after `--`: `npm run harness -- --test`.

Run a single test file or a single test:

```bash
npx ng test --watch=false --include src/shared/helpers/index.spec.ts
npx ng test --watch=false --filter "isExpenseEqual"     # regex over suite/test names
npx ng test --ui                                        # interactive Vitest UI
```

```bash
npm run lint            # ng lint -- ESLint + angular-eslint over src/**/*.ts and src/**/*.html
npx tsc -b tsconfig.app.json tsconfig.spec.json tsconfig.e2e.json   # plain TS project-reference build; also
                                                   # type-checks *.spec.ts, which `build` does not
```

The lint target also checks `e2e/**/*.ts` and `playwright.config.ts`. The harness
type-checks these files with `tsconfig.e2e.json`. Browser scenarios run separately
from the harness; see `e2e/README.md` for setup, Page Objects, fixtures, and reports.

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
It holds `CLIENT_ID`, `API_KEY`, `CLIENT_SECRET`, `APP_ID`, `GGG_KEY` and is **imported as a
module**, so a missing file — or a missing field — is a build-time module-resolution or
type-check failure. `APP_ID` is the Google Cloud project number, used by the Picker (see
`knowledge/interfaces/google-oauth.md`); `GGG_KEY` is the Gemini API key. CI writes all five fields from repository secrets. `keys.example.json` lacks `GGG_KEY`
(known issue #32 in `knowledge/constraints/known-issues.md`).

## Architecture

Angular 22 standalone, zoneless PWA (`provideZonelessChangeDetection`; no `zone.js`) + NgRx 22.
Components default to `OnPush`. **There is no backend**: the user's own Google
Spreadsheet is the database and the browser calls Google APIs directly. The `gapi` client
library is never loaded — only its TypeScript types are used. Sheets and OAuth requests use Angular's `HttpClient`;
Gemini uses the lazy `@google/genai` SDK and `fetch`.

## Knowledge base

`knowledge/` is an OKF v0.2 bundle (markdown + YAML frontmatter) documenting this project in
depth — start at [`knowledge/index.md`](knowledge/index.md). Read the relevant concept before
non-trivial work rather than re-deriving it:

| Question                               | Concept                                      |
| -------------------------------------- | -------------------------------------------- |
| How does state flow?                   | `knowledge/architecture/state-management.md` |
| What does this API call do?            | `knowledge/interfaces/`                      |
| How does this feature work end to end? | `knowledge/flows/`                           |
| What is the sheet layout?              | `knowledge/domain/spreadsheet-layout.md`     |
| What is already known to be broken?    | `knowledge/constraints/known-issues.md`      |
| Why is it failing?                     | `knowledge/operations/troubleshooting.md`    |
| How does the offline write queue work? | `knowledge/architecture/write-outbox.md`     |

Every concept cites its source files in frontmatter. The bundle is **unverified** — confirm a
claim against its sources before acting on it irreversibly.

[`docs/backend-less-assessment.md`](docs/backend-less-assessment.md) is a judgement rather
than a description: it evaluates the Sheets-as-backend design and ranks the improvements that
keep it.

## Subagents

`.claude/agents/` defines planner, architect, implementer, tester, reviewer, and orchestrator
roles, plus the `/orchestrate` command. They write to `docs/specs/`, `docs/architecture/`,
`docs/reviews/`, and `docs/dod/`.
