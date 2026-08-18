# exp-spsh

**Project**: Angular PWA expense tracking app with NgRx state management and Google Sheets API integration.

## Architecture

### State Management

- **NgRx pattern** (`src/@state/`): actions, effects, reducers, selectors, models
- **Key state**: AppState with SheetsState (EntityState), categories, expenses, selectedSheetId
- Store DevTools available via URL query param `?logger=true`

### Feature Modules

- **Dashboard**: Main expense tracking UI with categories, statistics, expenses table
- **Setup**: Authentication and initial configuration
- **Shared**: Common components (dialog), guards, helpers, models (Category, Expense, Sheet, Token, UserInfo)

### Services

- **Auth**: Abstract security service with popup/redirect implementations
- **Spreadsheet**: Google Sheets API integration
- **Storage**: Local storage with typed interface
- **Network**: Network status detection

### HTTP

- **Interceptor** (`src/http-interceptors/`): Auth token injection via `ExpAuthInterceptor`

## Quick Start Commands

- **Build**: `npm run build` (production) | `npm run watch` (development with watch)
- **Serve**: `npm run serve` — dev server at http://localhost:4200/exp-spsh/
- **Test**: `npm test` — Karma + Jasmine tests (headless)
- **Test (UI)**: `npm run test:headed` — Tests with Chrome UI
- **Setup**: Fill `keys.json` before first build


## CRITICAL RULES — MANDATORY
- NEVER delete or overwrite working tests without explicit permission
- NEVER delete files without confirmation
- ALWAYS run tests after any code changes
- ALWAYS create a git checkpoint before major refactorings
- One task at a time. DO NOT make multiple changes simultaneously
- If you're unsure — ASK, don't guess

## Working Style

- Plan first, then code
- Small changes: one file → tests → next file
- Use sub-agents to explore the codebase
- When reporting information, be extremely concise and sacrifice grammar for the sake of concision

## Agents

- Use the `planner` agent for planning
- Use the `tester` agent after code changes
- Use the `code-reviewer` agent before commits

## Key Behaviors

- **PWA**: Service worker registered with HashLocationStrategy
- **iOS Workaround**: Postinstall script patches iOS service worker compatibility
- **Dev Tools**: StoreDevtools conditionally enabled via URL param to reduce bundle
- **Base href**: Empty (use hash routing)
- **GAPI**: Google Auth and Sheets API types included

## Rules & Guidelines

See the `rules/` directory for detailed guidelines:

- [rules/code-style.md](rules/code-style.md) — Styling, TypeScript, and file organization conventions
- [rules/testing.md](rules/testing.md) — Testing framework and conventions
- [rules/development.md](rules/development.md) — Development environment setup and pitfalls
