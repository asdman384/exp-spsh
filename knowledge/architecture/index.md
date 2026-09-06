# Architecture

* [exp-spsh system overview](overview.md) - Single-page Angular PWA that records personal expenses directly into a user-owned Google Spreadsheet, with no backend of its own.
* [NgRx state management](state-management.md) - Shape of the single `app` feature slice, which actions are reducer-handled versus effect-only, and how state is hydrated from localStorage.
* [Routing and route guards](routing-and-guards.md) - Hash-based lazy route tree, the three guards that gate it, and the redirect targets when a guard fails.
* [Bootstrap and dependency wiring](dependency-wiring.md) - What `main.ts` and `app.config.ts` provide, which abstractions are bound to which implementations, and the global `log()` side channel.
* [PWA, service worker, and caching](pwa-and-service-worker.md) - How the app installs, what ngsw caches (and deliberately does not cache), the iOS patch applied at postinstall, and how updates reach the user.

# Judgement

* [Assessment of the backend-less design](backend-less-assessment.md) - A judgement on whether Google-Sheets-as-backend is the right bet, where the implementation fails the bet, and a ranked list of improvements that keep it.

# Related

* [Systems](../systems/) - the external systems this architecture depends on.
* [Interfaces](../interfaces/) - the concrete contracts at each boundary.
* [Source map](../references/source-map.md) - directory-by-directory index of the repository.
