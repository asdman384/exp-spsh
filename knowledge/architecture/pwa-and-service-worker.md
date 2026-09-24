---
type: Architecture Component
title: PWA, service worker, and caching
description: How the app installs, what ngsw caches (and deliberately does not cache), the iOS patch applied at postinstall, and how updates reach the user.
tags: [architecture, pwa, service-worker, caching, ios]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: ngsw
    resource: ../../ngsw-config.json
    title: Service worker configuration
  - id: ng
    resource: ../../angular.json
    title: baseHref
  - id: manifest
    resource: ../../src/manifest.webmanifest
    title: Web app manifest
  - id: iosfix
    resource: ../../scripts/service-worker-ios-workaround.js
    title: postinstall iOS patch
  - id: appcomp
    resource: ../../src/app/app.component.ts
    title: AppComponent update handling
  - id: swmode
    resource: ../../src/shared/helpers/service-worker-mode.ts
    title: Service worker on/off switch
  - id: main
    resource: ../../src/main.ts
    title: Stale worker removal before bootstrap
---

# Installability

`manifest.webmanifest`: `display: standalone`, `scope`/`start_url` `./`, theme `#1976d2`,
background `#fafafa`, eight PNG icons (72–512 px, `purpose: "maskable any"`).[^manifest]
`index.html` adds the iOS meta tags and a `theme-color` of `#673ab7` — different from the
manifest's.

# ngsw groups

```
assetGroups
  app     prefetch                   /favicon.ico, /index.html, /manifest.webmanifest, /*.css, /*.js
  assets  lazy, prefetch on update   /assets/**, /*.(svg|cur|jpg|jpeg|png|apng|webp|avif|gif|otf|ttf|woff|woff2)

dataGroups
  googleapis  freshness, maxSize 0, maxAge "0u"
    https://content-sheets.googleapis.com/*
    https://content.googleapis.com/*
```

1. **Globs name build-output files; `baseHref` supplies the deployed path.**[^ngsw] The
   generator matches each glob against the output directory (`/main-<hash>.js`) and prefixes
   the match with `baseHref` (`/exp-spsh/`)[^ng] to form `ngsw.json` URLs. A glob written as a
   deployed URL (`/exp-spsh/*.js`) matches nothing, and an empty `baseHref` yields URLs the
   page never requests; either way nothing is cached and an offline launch fails with
   `ERR_INTERNET_DISCONNECTED`. Non-empty `urls` and `hashTable` in the generated `ngsw.json`
   are the check.
2. **API responses are never cached.** The data group routes the two Sheets/userinfo hosts
   through the worker with zero cache. `docs.google.com` (gviz) and `oauth2.googleapis.com`
   are not listed and pass through untouched. Offline tolerance comes from the store,
   localStorage, and the [write outbox](write-outbox.md), not from Cache Storage.

# The iOS postinstall patch

`postinstall` runs `scripts/service-worker-ios-workaround.js`, which rewrites
`node_modules/@angular/service-worker/ngsw-worker.js` in place, appending
`.catch((e) => console.log(e))` to `cache.match/put/delete` calls via three regexes.[^iosfix]
Safari can reject Cache Storage operations and crash the worker without it.

- Installing with `--ignore-scripts` leaves the worker unpatched.
- The script prints each regex's matches; empty arrays after an Angular upgrade mean the
  upstream code shape changed and the patch no longer applies.

# When the worker runs

`ServiceWorkerModule.register` gets `enabled: isServiceWorkerEnabled()`, which is
`!isDevMode() || SERVICE_WORKER_IN_DEV`.[^swmode]

- **Production builds** (`npm run build`, CI, the harness) always register the worker.
- **Development builds** (`npm run watch`) register it only when the constant
  `SERVICE_WORKER_IN_DEV` is `true`; it is `false`, so every refresh loads the fresh build
  from the server (`http-server -c-1` disables HTTP caching too).
- With the worker off, `main.ts` calls `removeServiceWorker()` before bootstrap.[^main] It
  unregisters the registration whose scope equals `document.baseURI` (`…/exp-spsh/`) and
  deletes Cache Storage entries prefixed `ngsw:/exp-spsh/`; other scopes on the same origin
  are left alone. If a worker was controlling the page, the running bundle came from its cache,
  so the page reloads once instead of bootstrapping.
- Both configurations emit `ngsw-worker.js` and `ngsw.json` (`serviceWorker` is a base
  build option in `angular.json`), so flipping the constant needs no build config change.

# Update delivery

`AppComponent` maps `SwUpdate.versionUpdates` `VERSION_READY` to `hasUpdates`, shown as a `!`
badge on the avatar and an **Update** menu item that calls `location.reload()`.[^appcomp]

[^ngsw]: Service worker configuration
[^ng]: baseHref
[^manifest]: Web app manifest
[^iosfix]: postinstall iOS patch
[^appcomp]: AppComponent update handling
[^swmode]: Service worker on/off switch
[^main]: Stale worker removal before bootstrap
