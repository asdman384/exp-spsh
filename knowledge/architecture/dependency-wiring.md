---
type: Architecture Component
title: Bootstrap and dependency wiring
description: What `main.ts` and `app.config.ts` provide, which abstractions are bound to which implementations, and the global `log()` side channel.
tags: [architecture, di, bootstrap, angular]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: main
    resource: ../../src/main.ts
    title: Bootstrap entry point
  - id: appcfg
    resource: ../../src/app/app.config.ts
    title: getAppConfig() providers
  - id: logger
    resource: ../../src/logger.ts
    title: ExpLogger and the global log()
  - id: uikit
    resource: ../../src/shared/modules/uikit.module.ts
    title: UIKitModule
---

# Bootstrap order

`main.ts` does three things, in this order:[^main]

1. Registers `window` handlers for `unhandledrejection` and `error` (they only
   `console.log`; they do not suppress the default behaviour).
2. **Dynamically imports `./logger`**, which installs the global `log()` function, and only
   then calls `bootstrapApplication`. Nothing may call `log()` before this resolves.
3. Bootstraps `AppComponent` with `provideZoneChangeDetection()` plus
   `getAppConfig().providers`.

Zone.js change detection is still in use; the app has not moved to zoneless.

# Providers (`getAppConfig`)

| Token | Implementation | Note |
|---|---|---|
| `AbstractSecurityService` | `RedirectSecurityService` | swap to `PopupSecurityService` here to change the auth UX |
| `HTTP_INTERCEPTORS` (multi) | `ExpAuthInterceptor` | see [auth interceptor](../interfaces/http-auth-interceptor.md) |
| `LocationStrategy` | `HashLocationStrategy` | required for the GitHub Pages / `file://` serving model |
| `StorageService` | `LocalStorageService` | see [local storage](../interfaces/local-storage.md) |
| — | `provideHttpClient(withInterceptorsFromDi(), withJsonpSupport())` | DI-style interceptors, JSONP support enabled |
| — | `provideRouter(routes, withComponentInputBinding())` | [routing](routing-and-guards.md) |
| — | `ServiceWorkerModule.register('ngsw-worker.js', { enabled: true, registrationStrategy: 'registerWhenStable:30000' })` | **enabled unconditionally, including in dev** |
| — | `StoreModule.forRoot(reducers, { metaReducers })`, `EffectsModule.forRoot(AppEffects)` | [state](state-management.md) |
| — | `StoreDevtoolsModule.instrument(...)` | **conditional**: only when the URL has a `logger` query param |

`SpreadsheetService`, `NetworkStatusService` are `providedIn: 'root'`;
`LocalStorageService`, `PopupSecurityService`, `RedirectSecurityService` are plain
`@Injectable()` classes bound explicitly here.

# The global `log()` side channel

`src/logger.ts` declares `function log(...args: any[]): void` in the global scope and
attaches an `ExpLogger` instance to `window.log`.[^logger] It:

- mirrors everything to `console.log`;
- renders each argument into an on-page `<div class="logger-output">` overlay with
  copy / clear / toggle buttons (Material icon glyphs `content_copy`, `not_interested`,
  `memory`);
- serialises objects with `JSON.stringify(arg, null, 2)` and appends a stack trace for
  `Error` instances (via the V8-only `Error.captureStackTrace`).

`loggerType` is **hard-coded to `'window'`** — the line that read it from the URL is
commented out — so the overlay is installed on every load, in every environment. The
separate `?logger=` URL parameter still gates NgRx DevTools only.

Because `log()` is a global with no import, **it is used freely across effects, services,
guards and containers**, and any new environment (a test harness, SSR) must provide it or
those code paths throw. `tsconfig.app.json` and `tsconfig.spec.json` both explicitly
`include` `src/logger.ts` for this reason.

# UIKitModule

The single remaining NgModule. It re-exports the Material modules the app uses
(`toolbar`, `table`, `tabs`, `menu`, `badge`, `datepicker`, `checkbox`, `select`,
`progress-bar`, `progress-spinner`, `tooltip`, `icon`, `input`, `form-field`, `button`)
plus `CommonModule` and CDK `DragDropModule`, and provides date configuration:
`MAT_DATE_LOCALE = 'en-GB'` and a `MAT_DATE_FORMATS` override whose `dateInput` display is
`{ year: 'numeric', month: 'short', day: 'numeric' }`.[^uikit] Standalone components import
`UIKitModule` rather than individual Material modules.

[^main]: Bootstrap entry point
[^logger]: ExpLogger and the global log()
[^uikit]: UIKitModule
