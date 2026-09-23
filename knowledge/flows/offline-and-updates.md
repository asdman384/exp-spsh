---
type: Flow
title: Offline behaviour and app updates
description: What the app can and cannot do without a network, how online state is detected, and how a new deployment reaches an installed PWA.
tags: [flow, offline, pwa, updates, network]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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
  - id: outbox
    resource: ../../src/@state/outbox.effects.ts
    title: OutboxEffects
---

# Detecting connectivity

`NetworkStatusService.online$` is a `BehaviorSubject` seeded with `navigator.onLine` and
flipped by `window` `online`/`offline` events.[^net] It reports link state, not reachability:
a captive portal still reads as online.

It drives the `isOnline` guard, `loadExpenses$`'s wait, `addExpense$` routing, the outbox
drain, disabled menu items and login button, and the avatar's `online` CSS class (the app's
connectivity indicator).

# What works offline

| Capability | Offline |
|---|---|
| Open the app | yes, after one online visit installed the service worker |
| Categories list, selected person | yes — from localStorage |
| Last loaded expenses | yes, until reload (`expenses` is not persisted) |
| Load expenses | **deferred** until online ([load expenses](load-expenses.md)) |
| Add an expense | **queued** in IndexedDB, sent automatically ([write outbox](../architecture/write-outbox.md)) |
| Delete an expense | no — the request fails, the row is restored, a toast is shown |
| Categories and Statistics pages | blocked by `isOnline` (menu items disabled; guard redirects to root) |
| Login, Logout | disabled |
| Setup | not guarded; fails silently ([initial setup](initial-setup.md)) |

Draining runs only while a tab is open; there is no background sync. API responses are never
cached ([service worker](../architecture/pwa-and-service-worker.md)).

# The outbox indicator

While signed in, `OutboxStatusComponent` sits before the avatar and shows the pending +
failed count. Clicking it dispatches `syncRequested`, which starts a drain pass and reopens
the failure notice if a failed record exists.[^outbox]

# Update delivery

1. A push to `master` rebuilds and republishes ([CI](../operations/ci-and-deployment.md)).
2. The installed worker sees the new `ngsw.json` and emits `VERSION_READY`.
3. `AppComponent` sets `hasUpdates`: a `!` badge on the avatar and an **Update** menu item.[^appcomp]
4. **Update** calls `location.reload()`.

The menu footer shows `package.json`'s `version`; bumping it is manual.[^apphtml]

[^net]: NetworkStatusService
[^appcomp]: AppComponent page state
[^apphtml]: Toolbar and menu template
[^outbox]: OutboxEffects
