---
type: Architecture Overview
title: exp-spsh system overview
description: Single-page Angular PWA that records personal expenses directly into a user-owned Google Spreadsheet, with no backend of its own.
tags: [architecture, overview, pwa, angular]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
sources:
  - id: pkg
    resource: ../../package.json
    title: package.json (name, version, dependencies, scripts)
  - id: appcfg
    resource: ../../src/app/app.config.ts
    title: Root application providers
  - id: claude-md
    resource: ../../CLAUDE.md
    title: Repository agent instructions
---

# What it is

`exp-spsh` is an Angular 22 standalone, zoneless PWA for tracking day-to-day expenses. It has
**no server of its own**: the user's Google Spreadsheet is the database and the browser calls
Google APIs directly.[^appcfg]

| Property | Value |
|---|---|
| Version | `package.json` `version` (`0.13.0`), shown in the toolbar menu |
| Framework | Angular 22, standalone components, zoneless change detection; no authored `@NgModule` |
| State | NgRx 22, one slice `app`; expenses and the write outbox live in signal services |
| UI kit | Angular Material 22, prebuilt `deeppurple-amber` theme |
| Persistence | Google Sheets (remote); `localStorage` (config and cache); IndexedDB (offline write queue) |
| Auth | Google Identity Services OAuth 2.0, redirect flow, scope `drive.file` |
| AI | Gemini (`@google/genai`) turns voice notes and receipt photos into expenses |
| Hosting | GitHub Pages under `/exp-spsh/`, hash routing |

# Layers

```
 Browser (PWA + service worker)
   |-- Components / containers   src/modules/**, src/shared/components/**
   |        dispatch ^  | select
   |-- NgRx store + effects      src/@state/**
   |-- Signal services           ExpensesService, OutboxService (+ IndexedDB), VoiceRecorderService
   |-- Services                  SpreadsheetService, AbstractSecurityService, PickerService,
   |                             ExpenseRecognitionService, NetworkStatusService, LocalStorageService
   |        | HttpClient (ExpAuthInterceptor adds the Bearer token); Gemini via fetch
   v
 Google: Sheets v4 REST | gviz/tq query | OAuth2 + userinfo | Picker | Gemini
```

- Categories and spreadsheet config go through NgRx [actions](../interfaces/ngrx-actions.md)
  and effects; expenses go through `ExpensesService` and the outbox
  ([state management](state-management.md)). Setup calls `PickerService` and
  `SpreadsheetService` directly.
- Sheets and OAuth requests use Angular's `HttpClient`; the `gapi` API client is not loaded.
  Picker loads the `gapi` loader only for its picker module. Gemini uses the SDK's `fetch` path.

# Key choices

1. **Backend-less.** All credentials, `CLIENT_SECRET` included, ship in the bundle
   ([security posture](../constraints/security-posture.md)).
2. **Two auth strategies** behind `AbstractSecurityService`; redirect is wired
   ([authentication](../flows/authentication.md)).
3. **Angular HTTP requests ask for a valid token** via `ExpAuthInterceptor`, except
   token exchange and refresh requests. Gemini uses its API key outside this interceptor.
4. **Offline-tolerant.** Reads wait for connectivity; every new expense — typed or recognized
   from a [voice note](../flows/voice-recording.md) or confirmed
   [receipt draft](../flows/receipt-recognition.md) — is queued in IndexedDB and sent from there ([write outbox](write-outbox.md), [offline](../flows/offline-and-updates.md)).
5. **One tab per person.** Each user gets a `data_<name>` sheet in the shared spreadsheet
   ([spreadsheet layout](../domain/spreadsheet-layout.md)).

See the [source map](../references/source-map.md) and the
[app system record](../systems/exp-spsh-app.md).

[^appcfg]: Root application providers
