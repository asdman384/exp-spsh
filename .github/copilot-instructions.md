# Copilot Instructions — exp-spsh

**Project**: Angular 19 PWA expense tracking app with NgRx state management and Google Sheets API integration.

## Quick Start Commands

- **Build**: `npm run build` (production) | `npm run watch` (development with watch)
- **Serve**: `npm run serve` — dev server at http://localhost:4200/exp-spsh/
- **Test**: `npm test` — Karma + Jasmine tests (headless)
- **Test (UI)**: `npm run test:headed` — Tests with Chrome UI
- **Setup**: Fill `keys.json` before first build

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

## Code Conventions

### Styling
- **Preprocessor**: SCSS
- **Theme**: Angular Material (deeppurple-amber)
- **New components**: default to `.scss` (via schematics config)

### TypeScript
- **Strict mode** enabled: `strict: true`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, etc.
- **Target**: ES2022 with type strictness

### Testing
- **Framework**: Karma + Jasmine  
- **Browser**: ChromeHeadless (default) | Chrome (headed mode via `npm run test:headed`)
- **Pattern**: `.spec.ts` files co-located with source
- **Single run**: `singleRun: true` in karma.conf.js

### File Organization
```
src/
  @state/          # NgRx store, effects, actions, selectors
  app/             # Root module, routing, main component
  modules/         # Feature modules (dashboard, setup)
  services/        # Business logic, API clients
  shared/          # Reusable components, guards, helpers, models
  constants/       # UI strings, routes, spreadsheet configs
  environments/    # Dev/prod configuration
  http-interceptors/  # Auth interceptor
  fun/             # Seasonal components (snow effect)
```

## Development Environment

### Windows PowerShell Setup
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser  # before work
Set-ExecutionPolicy Restricted                        # after work
```

### Dependencies
- **Angular**: 19.2.3 (platform-browser, forms, material, router, animations, service-worker)
- **NgRx**: 19.0.1 (store, effects, entity, store-devtools)
- **Material**: 19.2.6
- **RxJS**: 7.8.1
- **Tooling**: Angular CLI 19.2.4, TypeScript 5.8.2

## Key Behaviors

- **PWA**: Service worker registered with HashLocationStrategy
- **iOS Workaround**: Postinstall script patches iOS service worker compatibility
- **Dev Tools**: StoreDevtools conditionally enabled via URL param to reduce bundle
- **Base href**: Empty (use hash routing)
- **GAPI**: Google Auth and Sheets API types included

## Common Tasks

### Add a feature
1. Create feature module in `src/modules/`
2. Add routing to `app-routing.module.ts`
3. Implement services in `src/services/` if needed
4. Create components with `.scss` (automatic via schematic)
5. Dispatch actions and use selectors from store

### Add a component
1. Templates use HTML with Material design
2. Styling: use SCSS with BEM or scoped approach
3. Testing: create `.spec.ts` alongside the component
4. Shared components: place in `src/shared/components/` and export from `index.ts`

### Modify store
1. Update `src/@state/app.model.ts` interface
2. Add/update actions in `app.actions.ts`
3. Implement side effects in `app.effects.ts` (async, API calls)
4. Update reducer in `app.reducers.ts`
5. Add selectors in `app.selectors.ts` for components to consume

### Add HTTP service
1. Create service in `src/services/`
2. Use `HttpClient` from `@angular/common/http`
3. Interceptor automatically injects auth headers
4. Return observables for NgRx effects to consume

## Pitfalls & Notes

- **keys.json required**: Build will fail silently if not configured
- **HashLocationStrategy**: Used intentionally to support file:// serving
- **Single Chrome instance**: Karma tests run in single browser, not headless by default
- **Service Worker caching**: May need cache invalidation during development
- **Strict typing**: `noPropertyAccessFromIndexSignature` means avoid dynamic property access without typed keys
