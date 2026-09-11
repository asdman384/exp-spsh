---
type: Architecture Overview
title: exp-spsh system overview
description: Single-page Angular PWA that records personal expenses directly into a user-owned Google Spreadsheet, with no backend of its own.
tags: [architecture, overview, pwa, angular]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: pkg
    resource: ../../package.json
    title: package.json (name, version, dependencies, scripts)
  - id: appcfg
    resource: ../../src/app/app.config.ts
    title: Root application providers
  - id: claude-md
    resource: ../../.github/CLAUDE.md
    title: Repository agent instructions
---

# What it is

`exp-spsh` (version `0.7.4`) is an Angular **21** standalone-component PWA for tracking
day-to-day expenses. It has **no server of its own**: the user's own Google Spreadsheet is
the database, and the browser talks to Google APIs directly.[^appcfg]

| Property | Value |
|---|---|
| App name / npm package | `exp-spsh` |
| Version | `0.7.4` (surfaced in the toolbar menu, read from `package.json`) |
| Framework | Angular 21, fully standalone components — no `@NgModule` is authored in `src/`; `StoreModule`/`EffectsModule`/`ServiceWorkerModule`/`StoreDevtoolsModule` are third-party NgModules wired in via `importProvidersFrom` |
| State | NgRx 21 (`store`, `effects`, `entity`, `store-devtools`) |
| UI kit | Angular Material 21, prebuilt `deeppurple-amber` theme |
| Persistence | Google Sheets (remote) + `localStorage` (config and cache) |
| Auth | Google Identity Services (OAuth 2.0), redirect flow by default |
| Hosting | GitHub Pages, served under the `/exp-spsh/` path |
| Routing | Hash routing (`HashLocationStrategy`), `baseHref` is empty |

# Layers

```
 Browser (PWA + service worker)
   |
   |-- Components / containers  --  src/modules/**, src/shared/components/**
   |        dispatch ^   | select
   |-- NgRx store ----+---+          --  src/@state/**
   |        | effects
   |-- Services  --  SpreadsheetService, AbstractSecurityService,
   |                 LocalStorageService, NetworkStatusService   --  src/services/**
   |        | HttpClient (ExpAuthInterceptor injects the Bearer token)
   v
 Google APIs  --  Sheets v4 REST | Visualization Query (gviz/tq) | OAuth2 | userinfo
```

- **Containers hold no business logic beyond form handling.** They dispatch
  [actions](../interfaces/ngrx-actions.md) and select slices of state.
- **Every remote read and write lives in an effect**, never in a component. See
  [state management](state-management.md).
- **The only HTTP client is Angular's `HttpClient`.** The `gapi` client library is *not*
  loaded at runtime; only its TypeScript types are used. See
  [the Sheets interface](../interfaces/google-sheets-api.md).

# Key architectural choices

1. **Backend-less by design.** The user owns the data and the app never sees it
   server-side. The consequence is that all credentials, `CLIENT_SECRET` included, ship
   inside the browser bundle ([security posture](../constraints/security-posture.md)).
2. **Two interchangeable auth strategies** behind `AbstractSecurityService`
   ([authentication](../flows/authentication.md)); the redirect one is the wired default.
3. **A token refresh is attempted on every outgoing HTTP call** through
   `ExpAuthInterceptor`, making that interceptor the single choke point for auth.
4. **Offline-tolerant reads.** `loadExpenses$` waits for connectivity before firing and
   guards block online-only routes ([offline and updates](../flows/offline-and-updates.md)).
5. **One tab per person.** Each user gets a `data_<name>` sheet in the same spreadsheet,
   which is what the dashboard's "User" selector switches between
   ([spreadsheet layout](../domain/spreadsheet-layout.md)).

# Where things live

See [the source map](../references/source-map.md) for a directory-by-directory index, and
[the app system record](../systems/exp-spsh-app.md) for the deployed-artifact view.

[^appcfg]: Root application providers
