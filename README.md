# ExpSpsh

expenses app

Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
Set-ExecutionPolicy Restricted

## 1 Build
- fill in keys.json
- Run `npx npm run watch` to build the project. The build artifacts will be stored in the `dist/` directory.


## 2 Development server
Run `npx npm run serve` for a dev server. Navigate to `http://localhost:4200/exp-spsh/`. The application will not automatically reload if you change any of the source files.


## Running unit tests
Run `npm test` to execute the unit tests with Angular's Vitest runner in headless Chromium.
Run `npm run test:headed` to run the tests in watch mode.

## Verification harness

Run `node scripts/harness.mjs` (or `npm run harness`) for lint, type-checking,
the production build, and tests. Works natively on Windows, Linux, and macOS
with Node.js and installed project dependencies; WSL and Bash are not required.
The production build goes to `tmp/harness-dist`, leaving the watch output intact.

```text
node scripts/harness.mjs --test --include src/shared/helpers/index.spec.ts
npm run harness -- --lint --typecheck
node scripts/harness.mjs --help
```

Flags: `--all` (default), `--lint`, `--typecheck`, `--build`, `--test`, and
`--include <path-or-glob>` to restrict tests. Quote globs. All selected layers run
even if one fails, and the final summary reports each result.
In PowerShell, use `npm.cmd run harness` if the execution policy blocks `npm.ps1`,
or use the direct `node` command above.

## Running end-to-end tests
End-to-end testing is not configured in this project.
