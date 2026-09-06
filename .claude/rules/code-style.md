# Code Style Guidelines

## Styling

- **Preprocessor**: SCSS
- **Theme**: Angular Material (deeppurple-amber)
- **New components**: default to `.scss` (via schematics config)

## TypeScript

- **Strict mode** enabled: `strict: true`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, etc.
- **Target**: ES2022 with type strictness

## File Organization

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
