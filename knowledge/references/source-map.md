---
type: Reference
title: Source map
description: Directory-by-directory index of the repository, with a pointer from each area to the concept that explains it.
tags: [reference, source-map, navigation]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: tree
    resource: ../../src
    title: Repository tree
---

# Repository root

| Path | What it is | Concept |
|---|---|---|
| `angular.json` | builders, budgets, assets, test and lint targets | [app system](../systems/exp-spsh-app.md) |
| `package.json` | deps, scripts, user-visible `version` | [toolchain](../systems/toolchain.md) |
| `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts` | compiler, lint, test config | [toolchain](../systems/toolchain.md), [testing](../operations/testing.md) |
| `ngsw-config.json` | service worker groups | [PWA](../architecture/pwa-and-service-worker.md) |
| `keys.json` / `keys.example.json` | Google credentials (untracked / template) | [configuration](../operations/configuration-and-secrets.md) |
| `scripts/harness.sh` | lint + typecheck + build + test gate | [build and serve](../operations/build-and-serve.md) |
| `scripts/service-worker-ios-workaround.js` | postinstall ngsw patch | [PWA](../architecture/pwa-and-service-worker.md) |
| `CLAUDE.md`, `AGENTS.md`, `.claude/` | agent instructions, rules, agents, settings, hooks | [working agreements](../constraints/working-agreements.md) |
| `policy/sprint-window.json` | agent write-scope policy | [working agreements](../constraints/working-agreements.md) |
| `.github/workflows/webpack.yml` | build and deploy to Pages | [GitHub Pages](../systems/github-pages.md) |
| `docs/` | specs, architecture notes, reviews, DoDs, and `backend-less-assessment.md` | — |
| `knowledge/` | this bundle | [index](../index.md) |

# `src/`

| Path | Contents | Concept |
|---|---|---|
| `main.ts`, `logger.ts` | bootstrap; the global `log()` | [dependency wiring](../architecture/dependency-wiring.md) |
| `index.html`, `manifest.webmanifest` | shell and PWA manifest | [PWA](../architecture/pwa-and-service-worker.md) |
| `styles.scss`, `css/fonts.scss` | global styles (incl. log overlay), Roboto | — |
| `app/` | root component, `app.config.ts`, `app.routes.ts` | [routing](../architecture/routing-and-guards.md) |
| `@state/` | `app.*` and `outbox.*` actions/effects/model/reducers/selectors, `report-failure.ts`, `outbox-messages.ts` | [state](../architecture/state-management.md), [write outbox](../architecture/write-outbox.md) |
| `constants/` | route, UI, storage-key, spreadsheet constants | [configuration](../operations/configuration-and-secrets.md) |
| `environments/` | `{ production }` flags, unused | [configuration](../operations/configuration-and-secrets.md) |
| `http-interceptors/` | `ExpAuthInterceptor` | [interceptor](../interfaces/http-auth-interceptor.md) |
| `services/security/` | abstract, popup, redirect strategies | [authentication](../flows/authentication.md) |
| `services/spreadsheet/` | `SpreadsheetService`, `expense-row.ts` | [Sheets API](../interfaces/google-sheets-api.md), [expense](../domain/expense.md) |
| `services/picker/` | `PickerService` | [OAuth and Picker](../interfaces/google-oauth.md) |
| `services/outbox/` | `OutboxStorage`, `IndexedDbOutboxStorage`, `InMemoryOutboxStorage` (test double), `OutboxDrainLock` | [write outbox](../architecture/write-outbox.md) |
| `services/storage/` | `StorageService`, `LocalStorageService` | [localStorage](../interfaces/local-storage.md) |
| `services/network-status.service.ts` | `online$` | [offline](../flows/offline-and-updates.md) |
| `services/voice-recorder/` | `VoiceRecorderService` — mic permission, `MediaRecorder` lifecycle, the latest in-memory recording | [voice recording](../flows/voice-recording.md) |
| `shared/models/` | `Expense`, `Category`, `Sheet`, `Token`, `Userinfo`, `OutboxRecord`, `VoiceRecording` | [domain](../domain/) |
| `shared/guards/` | `isLoggedIn`, `isOnline`, `isSetupReady` | [routing](../architecture/routing-and-guards.md) |
| `shared/helpers/` | `isExpenseEqual`, `toMessage`, `classifyWriteError`, `Memento`; `initial-url-params.ts` | [expense](../domain/expense.md), [write outbox](../architecture/write-outbox.md) |
| `shared/components/expenses-table/` | the shared table | [table contract](../interfaces/expenses-table-component.md) |
| `shared/components/outbox-status/`, `outbox-failure-notice/` | toolbar badge; Retry/Discard/Close snackbar (imported by path, not via the barrel) | [write outbox](../architecture/write-outbox.md) |
| `shared/components/voice-record-button/` | hold-to-record button (imported by path, not via the barrel) | [voice recording](../flows/voice-recording.md) |
| `shared/components/dialog/` | `ExpDialogComponent`, unused | — |
| `modules/dashboard/` | shell + `dashboard/`, `categories/`, `statistics/` | [flows](../flows/) |
| `modules/setup/` | shell + `login-page.containers.ts`, `setup-page/` | [initial setup](../flows/initial-setup.md) |
| `modules/playground/` | unguarded sandbox (own README) | [app system](../systems/exp-spsh-app.md) |
| `fun/snow/` | 14 February snow | [app system](../systems/exp-spsh-app.md) |
| `scripts/client.js` | vendored Google Identity Services, a global build script | [OAuth](../interfaces/google-oauth.md) |
| `assets/` | icons, images, fonts | — |

Specs are co-located `*.spec.ts` files; see [testing](../operations/testing.md).
