# Browser tests

## Run

Use Node and npm versions supported by the app. Run `npm ci`. All E2E projects
use Google Chrome Stable with a 425 × 896 CSS pixel viewport and touch input.
If Chrome is missing, run `npx playwright install chrome`. Install the video
recorder with `npx playwright install ffmpeg`. On a fresh Linux CI runner, use
`npx playwright install --with-deps chrome chromium ffmpeg` for E2E and Vitest.

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

| Command              | Run mode                                                                                                                   | Use                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `npm run e2e`        | Runs tests without a visible browser window by default. Results appear in the terminal.                                    | Routine checks and CI.                  |
| `npm run e2e:headed` | Runs tests with a visible browser window. You can see clicks, input, and navigation.                                       | Watch tests run live.                   |
| `npm run e2e:ui`     | Opens the Playwright UI to select and rerun tests, inspect steps and page snapshots, and view errors and network requests. | Develop tests and investigate failures. |

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
storage state explicitly.

## Google sign-in

Copy `e2e/google-tokens.example.json` to `e2e/google-tokens.local.json`.
Enter the Google OAuth access token and refresh token for the same test account
and the OAuth client in `keys.json`. Grant the app scopes `drive.file` and
`userinfo.profile`. Use a dedicated test account. In CI, create the same private
file from a secret before the run. Keep the private file and saved state out of reports.

Run `npm run e2e:auth`. The setup project checks the access token with Google.
It can reuse a previously saved access token for the same origin and refresh token.
If the token expires, the app uses the configured refresh token to obtain a new one.
After the app retrieves its Google profile, setup saves the verified state under
`tmp/playwright-auth/google.json`. If Google rejects the grant, replace the private
credentials and run again. The guest project runs independently with `npm run e2e`.

Add authenticated specs under `tests/authenticated/`. Playwright runs setup once
before the dependent tests and starts each test in a separate context.
The first test opens spreadsheet settings. The authenticated projects disable
traces, video, and screenshots.

For the spending scenario, use a dedicated test spreadsheet that the test
account has already set up through the app and can edit. Enter three more
fields in the same private JSON file:

| Field               | Value                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `spreadsheetId`     | The string between `/d/` and `/edit` in the spreadsheet URL.                                          |
| `categoriesSheetId` | The numeric `gid` in the URL when the `categories` tab is open. This tab needs at least one category. |
| `dataSheetId`       | The numeric `gid` for the test account's `data_<Google profile name>` tab.                            |

The spending test checks the tab names against their IDs and opens the dashboard
with the saved selection. It adds a `12.34` expense for today in Europe/Warsaw
with the first category and a unique comment. It reloads, checks the saved row,
deletes that row with a rightward drag, and reloads to check the deletion.
Run this scenario with `npm run e2e:auth -- spending.spec.ts`.
With `--headed`, this scenario pauses on the dashboard before adding the expense.
Use **Step over** in Playwright Inspector to follow each action, or **Resume**
to continue. Headless runs do not pause.

Use role and accessible-name locators, then test IDs if the UI has no suitable
accessible locator. Use Playwright's retrying assertions and automatic waiting.
Do not add fixed sleeps or a shared mutable page. Add page objects to the typed
fixture as new pages need them. Prefer composition for shared UI components.

The first test opens the app root, checks the guard redirect to `#/setup/login`,
and checks the title and visible, enabled Google sign-in button. It does not test
OAuth, service-worker updates, or spreadsheet access.

## Checks and reports

Do not run `scripts/harness.mjs`, or `npm run harness` during E2E
work. Use `npx tsc -p tsconfig.e2e.json`, `npx eslint e2e playwright.config.ts`,
and the relevant Playwright scenario instead. The harness includes E2E static
checks when it runs for other work. Existing Vitest tests remain
under `src/` and use `npm test`.

The HTML report is in `tmp/playwright-report`. Failure traces, screenshots,
and videos are in `tmp/playwright-results`. Both folders are ignored by Git.
Use `npx playwright show-trace <trace.zip>` to inspect a failure.

The projects inherit their browser settings from the top-level `use` in
`playwright.config.ts`. In CI, the config rejects `test.only`, uses
one worker, and retries failures twice. CI commands are `npm ci`, browser
installation, `node scripts/harness.mjs`, and `npm run e2e`; provide `keys.json`
before the build and retain both report folders on failure. The existing
deployment workflow does not run E2E tests.

This setup uses the supported Playwright [Page Object Model](https://playwright.dev/docs/pom),
[fixtures](https://playwright.dev/docs/test-fixtures), and
[web server](https://playwright.dev/docs/test-webserver) APIs.
