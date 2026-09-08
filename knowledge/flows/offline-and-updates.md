---
type: Flow
title: Offline behaviour and app updates
description: What the app can and cannot do without a network, how online state is detected, and how a new deployment reaches an installed PWA.
tags: [flow, offline, pwa, updates, network]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: net
    resource: ../../src/services/network-status.service.ts
    title: NetworkStatusService
  - id: appcomp
    resource: ../../src/app/app.component.ts
    title: AppComponent page state
  - id: apphtml
    resource: ../../src/app/app.component.html
    title: Toolbar and menu template
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: whenOnline gate
---

# Detecting connectivity

`NetworkStatusService` seeds a `BehaviorSubject` with `navigator.onLine` and flips it on the
`window` `online` / `offline` events.[^net] That is the app's only definition of
connectivity — it reports link state, not reachability, so a captive portal or a blocked
Google endpoint still reads as "online".

`online$` feeds four things: the `isOnline` guard, the `whenOnline` gate in `loadExpenses$`,
the disabled state of menu items and the login button, and a CSS `online` class on the
toolbar avatar (the avatar is the app's connectivity indicator).

# What works offline

| Capability | Offline |
|---|---|
| Open the app, see the shell | yes — the service worker prefetches the app shell |
| See categories and the selected person | yes — hydrated from localStorage |
| See the last loaded expenses | yes, until reload — `expenses` is not persisted |
| Load expenses | **deferred**: the dispatch parks on `whenOnline` and fires when the network returns |
| Add / delete an expense, edit categories | no — the request fails and the error is only logged |
| Categories and Statistics routes | blocked by the `isOnline` guard (redirect to root) |
| Login / logout / setup | login button and Logout are disabled offline; the setup route itself is *not* guarded |

Note the asymmetry: reads queue, writes do not. There is no outbox or background sync, and
Google API responses are explicitly never cached
([service worker](../architecture/pwa-and-service-worker.md)).

# Update delivery

1. A push to `master` rebuilds and republishes to GitHub Pages
   ([CI and deployment](../operations/ci-and-deployment.md)).
2. The installed service worker notices the new `ngsw.json` and emits `VERSION_READY`.
3. `AppComponent` maps that to `hasUpdates`, which paints a `!` badge on the avatar and adds
   an **Update** item to the menu.[^appcomp]
4. `update()` calls `location.reload()`; the worker activates the new version on the next
   navigation.

The version shown at the bottom of the menu is `package.json`'s `version` field, imported
directly — bumping it is a manual step and is what makes a release visible to users.[^apphtml]

[^net]: NetworkStatusService
[^appcomp]: AppComponent page state
[^apphtml]: Toolbar and menu template
