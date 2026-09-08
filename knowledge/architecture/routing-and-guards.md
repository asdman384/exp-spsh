---
type: Architecture Component
title: Routing and route guards
description: Hash-based lazy route tree, the three guards that gate it, and the redirect targets when a guard fails.
tags: [architecture, routing, guards, angular]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: routes
    resource: ../../src/app/app.routes.ts
    title: Root routes
  - id: dashroutes
    resource: ../../src/modules/dashboard/dashboard.routes.ts
    title: Dashboard child routes
  - id: setuproutes
    resource: ../../src/modules/setup/setup.routes.ts
    title: Setup child routes
  - id: guards
    resource: ../../src/shared/guards/index.ts
    title: isLoggedIn / isOnline / isSetupReady
  - id: routeenum
    resource: ../../src/constants/route.ts
    title: ROUTE enum
---

# Route tree

All paths come from the `ROUTE` enum, never from string literals.[^routeenum] Location
strategy is `HashLocationStrategy`, so URLs look like
`https://host/exp-spsh/#/dashboard/statistics`.

| Path | Component | Guards | Loading |
|---|---|---|---|
| `''` | — | — | redirects to `dashboard` |
| `dashboard` | `DashboardComponent` | `isLoggedIn`, `isSetupReady` | lazy `loadComponent` + `loadChildren` |
| `dashboard/''` | `DashboardPageContainer` | inherited | eager within the chunk |
| `dashboard/categories` | `CategoriesPageContainer` | `isLoggedIn`, `isOnline` | eager within the chunk |
| `dashboard/statistics` | `StatisticsContainer` | `isLoggedIn`, `isOnline` (+ `canDeactivate`) | eager within the chunk |
| `setup` | `SetupComponent` | none | lazy |
| `setup/''` | — | — | redirects to `login` |
| `setup/login` | `LoginPageContainer` | none | eager within the chunk |
| `setup/settings` | `SettingsPageContainer` | `isLoggedIn` | eager within the chunk |
| `playground` | `PlaygroundComponent` | **none** | lazy |

`provideRouter` is configured `withComponentInputBinding()`, and view transitions are
enabled via `withViewTransitions(...).ɵproviders` (the callback is currently a no-op used
for experimentation).

The `statistics` route declares an inline `canDeactivate` that calls
`component.tableAnimation('none')` and always returns `true` — it exists to reset a CSS
animation class on leave, not to block navigation.[^dashroutes]

# Guards

All three guards are functional guards returning `Observable<boolean | UrlTree>`.[^guards]

| Guard | Passes when | Failure redirect |
|---|---|---|
| `isLoggedIn` | `AbstractSecurityService.user$` emits a user | `UrlTree` to `setup` |
| `isSetupReady` | both `spreadsheetId` **and** `categoriesSheetId` are set in the store | `UrlTree` to `setup` |
| `isOnline` | `NetworkStatusService.online$` is `true` | `UrlTree` to `[]` (the root route) |

Because guard observables are long-lived (`user$`, `online$` are `BehaviorSubject`-backed),
they re-emit on state change; Angular only consumes the first emission per activation.

# Navigation conventions

- The toolbar menu links use `queryParamsHandling="preserve"` so the OAuth `state`/`code`
  parameters and the `logger` flag survive in-app navigation.
- `finishSetup()` in the settings page navigates to `dashboard` with
  `queryParams: { state: null, code: null, scope: null }` and `queryParamsHandling: 'merge'`
  — this is the one place OAuth redirect parameters are deliberately stripped from the URL.
- `LoginPageContainer` navigates to `setup/settings` with `replaceUrl: true` as soon as
  `user$` emits, so the login page is not left in history.

See [authentication](../flows/authentication.md) and [initial setup](../flows/initial-setup.md).

[^routeenum]: ROUTE enum
[^dashroutes]: Dashboard child routes
[^guards]: isLoggedIn / isOnline / isSetupReady
