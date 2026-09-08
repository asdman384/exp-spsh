---
type: Reference
title: Source map
description: Directory-by-directory index of the repository, with a pointer from each area to the concept that explains it.
tags: [reference, source-map, navigation]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: tree
    resource: ../../src
    title: Repository tree as of commit 78b5109
---

# Repository root

| Path | What it is | Concept |
|---|---|---|
| `angular.json` | builders, budgets, assets, test target | [app system](../systems/exp-spsh-app.md) |
| `package.json` | deps, scripts, the user-visible `version` | [toolchain](../systems/toolchain.md) |
| `tsconfig*.json` | strictness, ambient types, spec includes | [technical constraints](../constraints/technical-constraints.md) |
| `vitest.config.ts` | test environment | [testing](../operations/testing.md) |
| `ngsw-config.json` | service worker groups | [PWA](../architecture/pwa-and-service-worker.md) |
| `keys.json` / `keys.example.json` | Google credentials (untracked / template) | [configuration](../operations/configuration-and-secrets.md) |
| `scripts/service-worker-ios-workaround.js` | postinstall ngsw patch | [PWA](../architecture/pwa-and-service-worker.md) |
| `policy/sprint-window.json` | agent write-scope policy | [working agreements](../constraints/working-agreements.md) |
| `.github/CLAUDE.md`, `.github/rules/*.md` | repository instructions and rules | [working agreements](../constraints/working-agreements.md) |
| `.github/workflows/webpack.yml` | build and deploy to Pages | [CI](../operations/ci-and-deployment.md) |
| `.claude/settings.json`, `settings copy.json` | tool permissions (second one inactive) | [working agreements](../constraints/working-agreements.md) |
| `logs/audit.log` | empty, gitignored | — |
| `test.ts` | scratch experiment, unreferenced | [known issues](../constraints/known-issues.md) |
| `OKF/SPEC.md` | the Open Knowledge Format spec this bundle follows | [bundle root](../index.md) |

# `src/`

| Path | Contents | Concept |
|---|---|---|
| `main.ts` | error handlers, logger import, bootstrap | [dependency wiring](../architecture/dependency-wiring.md) |
| `logger.ts` | `ExpLogger`, the global `log()` | [dependency wiring](../architecture/dependency-wiring.md) |
| `index.html`, `manifest.webmanifest` | shell and PWA manifest | [PWA](../architecture/pwa-and-service-worker.md) |
| `styles.scss`, `css/fonts.scss` | global styles, self-hosted Roboto woff2 | — |
| `app/` | `app.component.*`, `app.config.ts`, `app.routes.ts` | [routing](../architecture/routing-and-guards.md) |
| `@state/` | `app.actions/effects/model/reducers/selectors.ts` | [state](../architecture/state-management.md) |
| `constants/` | `route.ts`, `UI.ts`, `local-storage-keys.ts`, `spreadsheets.ts` | [configuration](../operations/configuration-and-secrets.md) |
| `environments/` | prod / dev flags (mostly vestigial) | [configuration](../operations/configuration-and-secrets.md) |
| `http-interceptors/` | `auth-interceptor.ts` | [interceptor](../interfaces/http-auth-interceptor.md) |
| `services/security/` | abstract + popup + redirect strategies | [authentication](../flows/authentication.md) |
| `services/spreadsheet/` | `spreadsheet.service.ts` (+ spec) | [Sheets API](../interfaces/google-sheets-api.md) |
| `services/storage/` | `StorageService` interface + localStorage impl | [storage](../interfaces/local-storage.md) |
| `services/network-status.service.ts` | online/offline stream | [offline](../flows/offline-and-updates.md) |
| `shared/models/` | `Expense`, `Category`, `Sheet`, `Token`, `Userinfo` | [domain](../domain/) |
| `shared/guards/` | `isLoggedIn`, `isOnline`, `isSetupReady` | [routing](../architecture/routing-and-guards.md) |
| `shared/helpers/` | `isExpenseEqual` (+ the best-covered spec) | [expense](../domain/expense.md) |
| `shared/components/expenses-table/` | the shared table | [table contract](../interfaces/expenses-table-component.md) |
| `shared/components/dialog/` | `ExpDialogComponent`, currently unused | [known issues](../constraints/known-issues.md) |
| `shared/modules/uikit.module.ts` | Material re-exports + date config | [dependency wiring](../architecture/dependency-wiring.md) |
| `modules/dashboard/` | shell + `dashboard/`, `categories/`, `statistics/` containers | [flows](../flows/) |
| `modules/setup/` | shell + `login-page.containers.ts`, `setup-page/` | [initial setup](../flows/initial-setup.md) |
| `modules/playground/` | unguarded Angular sandbox (own README) | [app system](../systems/exp-spsh-app.md) |
| `fun/snow/` | 14 February snow effect | [app system](../systems/exp-spsh-app.md) |
| `scripts/client.js` | global script injected by the build | — |
| `assets/` | icons, images, Roboto woff2 fonts | — |

# Test files

Ten `.spec.ts` files, co-located. Three are `describe.skip`; the substantive ones are
`shared/helpers/index.spec.ts` and `services/spreadsheet/spreadsheet.service.spec.ts`.
See [testing](../operations/testing.md).

# Branches seen in the repository

`master` (default), local `w2/feature-expense-templates`, and remote
`4-improvements`, `codex/find-and-fix-error-in-codebase`, `inDebt-feature`,
`playground-page`.
