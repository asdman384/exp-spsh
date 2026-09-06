# Testing Conventions

- **Framework**: Angular's Vitest runner
- **Browser**: Chromium headless (`chromiumHeadless`, configured in `angular.json`)
- **Pattern**: `.spec.ts` files co-located with source
- **Configuration**: `vitest.config.ts` and the Angular `test` target in `angular.json`

## Commands

- **Run tests**: `npm test` — runs once in headless Chromium
- **Run tests (watch)**: `npm run test:headed` — reruns tests when source files change
- **Run Vitest UI**: `npx ng test --ui` — starts the Vitest UI when interactive inspection is needed
