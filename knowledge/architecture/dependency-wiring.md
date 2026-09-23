---
type: Architecture Component
title: Bootstrap and dependency wiring
description: What `main.ts` and `app.config.ts` provide, which abstractions are bound to which implementations, and the global `log()` side channel.
tags: [architecture, di, bootstrap, angular]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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
  - id: urlparams
    resource: ../../src/shared/helpers/initial-url-params.ts
    title: initialUrlParams
  - id: outboxstorage
    resource: ../../src/services/outbox/outbox-storage.ts
    title: OutboxStorage root binding
---

# Bootstrap order

`main.ts`:[^main]

1. dynamically imports `./logger`, which installs the global `log()`;
2. awaits `getAppConfig()` (async — it may dynamically import `@ngrx/store-devtools`);
3. calls `bootstrapApplication(AppComponent, { providers: [provideZonelessChangeDetection(), appConfig.providers] })`.

A rejection anywhere in the chain is written to `console.error` and `log()`. The app is
**zoneless**; `zone.js` is not a dependency.

# Providers (`getAppConfig`)

| Token | Implementation | Note |
|---|---|---|
| `AbstractSecurityService` | `RedirectSecurityService` | swap to `PopupSecurityService` here to change the auth UX |
| `HTTP_INTERCEPTORS` (multi) | `ExpAuthInterceptor` | see [auth interceptor](../interfaces/http-auth-interceptor.md) |
| `LocationStrategy` | `HashLocationStrategy` | GitHub Pages cannot rewrite deep links |
| `StorageService` | `LocalStorageService` | see [localStorage](../interfaces/local-storage.md) |
| — | `provideHttpClient(withXhr(), withInterceptorsFromDi(), withJsonpSupport())` | XHR backend, class-based interceptors |
| — | `provideRouter(routes, withComponentInputBinding())` + `withViewTransitions(...).ɵproviders` | [routing](routing-and-guards.md) |
| — | `ServiceWorkerModule.register('ngsw-worker.js', { enabled: true, registrationStrategy: 'registerWhenStable:30000' })` | **enabled in development too** |
| — | `StoreModule.forRoot(reducers, { metaReducers })`, `EffectsModule.forRoot([AppEffects, OutboxEffects])` | [state](state-management.md) |
| — | `StoreDevtoolsModule.instrument(...)` | only when the URL has a `logger` query param; the package is a lazy chunk fetched only then |

Root-provided (`providedIn: 'root'`): `SpreadsheetService`, `NetworkStatusService`,
`PickerService`, `IndexedDbOutboxStorage`, `OutboxDrainLock`, and `OutboxStorage`.

`OutboxStorage` is an abstract class that binds itself —
`@Injectable({ providedIn: 'root', useFactory: () => inject(IndexedDbOutboxStorage) })` — so
it needs no line in `app.config.ts`, and a `TestBed` that does not provide it can still build
`AppEffects`. See [the write outbox](write-outbox.md).

# Pre-hash query parameters

`initialUrlParams` (`src/shared/helpers/initial-url-params.ts`) captures the query string
before the `#` once, at module load.[^urlparams] The router's first redirect drops that query
string from the address bar, so anything that needs `code`, `state`, or `logger` reads it from
here: `RedirectSecurityService`, `LoginPageContainer`, and `app.config.ts`.

# The global `log()`

`src/logger.ts` declares a global `log(...args)` and assigns it to `window.log`:[^logger]

- it is first bound to `console.log`, then — whenever `<body>` exists, i.e. always in the
  browser — replaced by an `ExpLogger` that writes to the console **and** to an on-page
  overlay;
- the overlay is always installed, parked off-screen, with a `memory` toggle button plus
  copy (`content_copy`) and clear (`not_interested`) buttons;
- objects are serialised with `JSON.stringify(arg, null, 2)`; `Error`s get a stack trace via
  the V8-only `Error.captureStackTrace`.

`logger.ts` also parses `?logger=` into an unused `loggerType`; that parameter only gates
DevTools.

`log()` is used without import in effects, services, guards, and containers. Any new
environment must install it first: `tsconfig.app.json` and `tsconfig.spec.json` both include
`src/logger.ts`, and effect specs install a stub (see [testing](../operations/testing.md)).

# Material and CDK imports

There is no shared UI-kit module. Each standalone component imports only the Material/CDK
modules and `@angular/common` pipes its own template uses, so heavy modules (datepicker,
table, tabs, drag-drop) stay in the lazy `dashboard` chunk.

`DashboardPageContainer` — the only datepicker host — provides `MAT_DATE_LOCALE = 'en-GB'`
and a `MAT_DATE_FORMATS` override (`dateInput: { year: 'numeric', month: 'short', day:
'numeric' }`) in its own `providers`.

`ExpDialogComponent` (`src/shared/components/dialog/`) is unused.

[^main]: Bootstrap entry point
[^logger]: ExpLogger and the global log()
[^urlparams]: initialUrlParams
