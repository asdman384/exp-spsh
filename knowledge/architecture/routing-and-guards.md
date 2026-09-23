---
type: Architecture Component
title: Routing and route guards
description: Hash-based lazy route tree, the three guards that gate it, and the redirect targets when a guard fails.
tags: [architecture, routing, guards, angular]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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

Paths come from the `ROUTE` enum.[^routeenum] With `HashLocationStrategy`, URLs look like
`https://host/exp-spsh/#/dashboard/statistics`.

| Path | Component | Guards | Loading |
|---|---|---|---|
| `''` | — | — | redirects to `dashboard` |
| `dashboard` | `DashboardComponent` | `isLoggedIn`, `isSetupReady` | lazy |
| `dashboard/''` | `DashboardPageContainer` | inherited | in the dashboard chunk |
| `dashboard/categories` | `CategoriesPageContainer` | `isLoggedIn`, `isOnline` | in the dashboard chunk |
| `dashboard/statistics` | `StatisticsContainer` | `isLoggedIn`, `isOnline`, `canDeactivate` | in the dashboard chunk |
| `setup` | `SetupComponent` | — | lazy |
| `setup/''` | — | — | redirects to `login` |
| `setup/login` | `LoginPageContainer` | — | in the setup chunk |
| `setup/settings` | `SettingsPageContainer` | `isLoggedIn` | in the setup chunk |
| `playground` | `PlaygroundComponent` | — | lazy |

`provideRouter` uses `withComponentInputBinding()`; view transitions are enabled via
`withViewTransitions(...).ɵproviders` with a no-op callback.

The `statistics` `canDeactivate` calls `component.tableAnimation('none')` and returns `true`;
it resets a CSS class, it never blocks.[^dashroutes]

# Guards

Functional guards returning `Observable<boolean | UrlTree>`:[^guards]

| Guard | Passes when | Otherwise |
|---|---|---|
| `isLoggedIn` | `AbstractSecurityService.user$` holds a user | `UrlTree` to `setup` |
| `isSetupReady` | `spreadsheetId` **and** `categoriesSheetId` are truthy in the store | `UrlTree` to `setup` |
| `isOnline` | `NetworkStatusService.online$` is `true` | `UrlTree` to `[]` (root) |

# Navigation conventions

- Toolbar menu links use `queryParamsHandling="preserve"`.
- `LoginPageContainer` navigates to `setup/settings` (`replaceUrl: true`) as soon as `user$`
  emits a user.
- `finishSetup()` navigates to `dashboard` with `queryParams: { state: null, code: null,
  scope: null }` and `queryParamsHandling: 'merge'`.

OAuth `code`/`state` and `?logger=` sit before the `#` and are read once at startup from
`initialUrlParams` ([dependency wiring](dependency-wiring.md#pre-hash-query-parameters)).
See [authentication](../flows/authentication.md) and [initial setup](../flows/initial-setup.md).

[^routeenum]: ROUTE enum
[^dashroutes]: Dashboard child routes
[^guards]: isLoggedIn / isOnline / isSetupReady
