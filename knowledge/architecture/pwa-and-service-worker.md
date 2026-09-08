---
type: Architecture Component
title: PWA, service worker, and caching
description: How the app installs, what ngsw caches (and deliberately does not cache), the iOS patch applied at postinstall, and how updates reach the user.
tags: [architecture, pwa, service-worker, caching, ios]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: ngsw
    resource: ../../ngsw-config.json
    title: Service worker configuration
  - id: manifest
    resource: ../../src/manifest.webmanifest
    title: Web app manifest
  - id: iosfix
    resource: ../../scripts/service-worker-ios-workaround.js
    title: postinstall iOS patch
  - id: appcomp
    resource: ../../src/app/app.component.ts
    title: AppComponent update handling
---

# Installability

`manifest.webmanifest` declares `display: standalone`, `scope: "./"`, `start_url: "./"`,
theme `#1976d2`, background `#fafafa`, and eight PNG icons from 72px to 512px, each with
`purpose: "maskable any"`.[^manifest] `index.html` additionally sets the iOS meta tags
(`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: translucent`) and
a `theme-color` of `#673ab7` — note this **differs from the manifest theme colour**.

# ngsw asset and data groups

```
assetGroups
  app     prefetch  /exp-spsh/favicon.ico, index.html, manifest.webmanifest, *.css, *.js
  assets  lazy + prefetch-on-update  /exp-spsh/assets/**  and  /*.(svg|cur|jpg|...|woff2)

dataGroups
  googleapis  freshness, maxSize 0, maxAge "0u"
    https://content-sheets.googleapis.com/*
    https://content.googleapis.com/*
    https://docs.google.com/a/google.com/spreadsheets/*
```

Two things follow.[^ngsw]

1. **The asset globs are hard-coded to the `/exp-spsh/` deployment path.** Serving the app
   from any other path leaves the app-shell group unmatched. This is coupled to the
   GitHub Pages project-site URL — see
   [deployment](../operations/ci-and-deployment.md).
2. **API responses are intentionally never cached** (`maxSize: 0`, `maxAge: "0u"`,
   `strategy: freshness`). The dataGroup exists to *route* those URLs through the worker
   without serving stale expense data. Offline reads therefore fail rather than return
   stale rows; offline tolerance comes from the store cache and the guards instead
   ([offline behaviour](../flows/offline-and-updates.md)).

# The iOS postinstall patch

`npm postinstall` runs `scripts/service-worker-ios-workaround.js`, which **rewrites
`node_modules/@angular/service-worker/ngsw-worker.js` in place**, appending
`.catch((e) => console.log(e))` to every `cache.match/put/delete` call via three regular
expressions.[^iosfix] It exists because Safari/iOS can reject Cache Storage operations and
crash the worker.

Consequences to keep in mind:

- The patch is applied to a file inside `node_modules`, so **it is lost on any
  `npm ci`/`npm install` that does not run postinstall**, and re-applied idempotently
  otherwise (the regexes do not re-match already-patched code for the `await` form).
- The script prints what each regex matched, which is the quickest way to check whether an
  Angular upgrade broke it: empty match arrays mean the upstream code shape changed.

# Update delivery

The service worker registers with `registrationStrategy: 'registerWhenStable:30000'` and is
`enabled: true` unconditionally (the `!isDevMode()` guard is commented out), so **the
worker is active during local development too** — stale-asset confusion in dev is expected
and is resolved by unregistering the worker or hard-reloading.

`AppComponent` subscribes to `SwUpdate.versionUpdates`, maps `VERSION_READY` to a
`hasUpdates` flag, and surfaces it as a badge on the avatar plus an "Update" menu item
whose handler is simply `location.reload()`.[^appcomp]

[^ngsw]: Service worker configuration
[^manifest]: Web app manifest
[^iosfix]: postinstall iOS patch
[^appcomp]: AppComponent update handling
