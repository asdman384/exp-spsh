# Knowledge Bundle Update Log

## 2026-09-05

* **Initialization**: Created the OKF v0.2 bundle for exp-spsh from a full read of the
  repository at commit `78b5109` ("update tests docs") on `master`.
* **Creation**: Architecture section — [overview](/architecture/overview.md),
  [state management](/architecture/state-management.md),
  [routing and guards](/architecture/routing-and-guards.md),
  [dependency wiring](/architecture/dependency-wiring.md),
  [PWA and service worker](/architecture/pwa-and-service-worker.md).
* **Creation**: Domain section — [expense](/domain/expense.md),
  [category](/domain/category.md), [sheet and user](/domain/sheet-and-user.md),
  [spreadsheet layout](/domain/spreadsheet-layout.md), [glossary](/domain/glossary.md).
* **Creation**: Flows section — eight end-to-end flows covering authentication, setup,
  the expense lifecycle, categories, statistics, and offline behaviour.
* **Creation**: Interfaces section — the three Google boundaries plus the interceptor,
  the NgRx action surface, the shared table contract, and the localStorage keys.
* **Creation**: Systems section — the app artifact, the Google backend, GitHub
  Actions/Pages, and the development toolchain.
* **Creation**: Operations section — build and serve, testing, CI and deployment,
  configuration and secrets, troubleshooting.
* **Creation**: Constraints section — working agreements, technical constraints, security
  posture, code conventions, and [known issues](/constraints/known-issues.md) (19 entries
  derived from reading the code, none reproduced at runtime).
* **Creation**: [Source map](/references/source-map.md) as the navigation reference.
