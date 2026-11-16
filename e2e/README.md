# Browser tests

## Run

Use Node and npm versions supported by the app. Run `npm ci`, then
`npx playwright install chromium`. On Linux CI, use
`npx playwright install --with-deps chromium`.

The build requires the root `keys.json` with all five fields described in
`CLAUDE.md`. The signed-out test does not sign in or use a Google account.

```sh
npm run e2e
npm run e2e:headed
npm run e2e:ui
npm run e2e -- --grep "signed-out"
npm run e2e:report
```

All three test commands use the same tests. Choose the run mode you need:

| Command | Run mode | Use |
| --- | --- | --- |
| `npm run e2e` | Runs tests without a visible browser window by default. Results appear in the terminal. | Routine checks and CI. |
| `npm run e2e:headed` | Runs tests with a visible browser window. You can see clicks, input, and navigation. | Watch tests run live. |
| `npm run e2e:ui` | Opens the Playwright UI to select and rerun tests, inspect steps and page snapshots, and view errors and network requests. | Develop tests and investigate failures. |

`--headed` does not slow down tests or pause them. Actions can finish too fast
to inspect live. UI mode lets you inspect the page before and after each step.
See the Playwright [run modes](https://playwright.dev/docs/running-tests)
and [UI mode](https://playwright.dev/docs/test-ui-mode) documentation.

Playwright builds production assets into `tmp/e2e-dist/exp-spsh`, starts the
installed `http-server` on `127.0.0.1:4300`, waits for the app, and stops the
server after the run. Port 4300 must be free. The build does not change `dist/`
or `tmp/harness-dist`. No watch process is required.

To test an existing server, set `E2E_BASE_URL` to its full app URL, including
the trailing `/exp-spsh/`. This skips the local build and server. PowerShell:

```powershell
$env:E2E_BASE_URL = 'http://localhost:4200/exp-spsh/'
npm run e2e
Remove-Item Env:E2E_BASE_URL
```

## Structure

- `tests/`: scenarios and assertions, grouped by feature as coverage grows.
- `pages/`: page objects with locators and user actions.
- `fixtures/test.ts`: typed, test-scoped page objects from Playwright's `page` fixture.
- `../playwright.config.ts`: browser projects, execution settings, and server lifecycle.

Each test has an isolated browser context. The signed-out suite sets an empty
storage state explicitly. Add authenticated state through a separate fixture or
project when needed; keep saved credentials under ignored `tmp/`.

Use role and accessible-name locators, then test IDs if the UI has no suitable
accessible locator. Use Playwright's retrying assertions and automatic waiting.
Do not add fixed sleeps or a shared mutable page. Add page objects to the typed
fixture as new pages need them. Prefer composition for shared UI components.

The first test opens the app root, checks the guard redirect to `#/setup/login`,
and checks the title and visible, enabled Google sign-in button. It does not test
OAuth, service-worker updates, or spreadsheet access.

## Checks and reports

`node scripts/harness.mjs` includes E2E TypeScript and lint checks. Run
`npm run e2e` separately for browser scenarios. Existing Vitest tests remain
under `src/` and use `npm test`.

The HTML report is in `tmp/playwright-report`. Failure traces, screenshots,
and videos are in `tmp/playwright-results`. Both folders are ignored by Git.
Use `npx playwright show-trace <trace.zip>` to inspect a failure.

The initial browser project is Chromium. Add entries to `projects` and install
their browsers to extend coverage. In CI, the config rejects `test.only`, uses
one worker, and retries failures twice. CI commands are `npm ci`, browser
installation, `node scripts/harness.mjs`, and `npm run e2e`; provide `keys.json`
before the build and retain both report folders on failure. The existing
deployment workflow does not run E2E tests.

This setup uses the supported Playwright [Page Object Model](https://playwright.dev/docs/pom),
[fixtures](https://playwright.dev/docs/test-fixtures), and
[web server](https://playwright.dev/docs/test-webserver) APIs.
