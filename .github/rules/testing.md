# Testing Conventions

- **Framework**: Karma + Jasmine
- **Browser**: ChromeHeadless (default) | Chrome (headed mode via `npm run test:headed`)
- **Pattern**: `.spec.ts` files co-located with source
- **Single run**: `singleRun: true` in karma.conf.js

## Commands

- **Run tests**: `npm test` — runs with ChromeHeadless, watch=false
- **Run tests (UI)**: `npm run test:headed` — runs with Chrome browser, watch=true
