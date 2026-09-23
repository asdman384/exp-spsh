---
type: Reference
title: Configuration and secrets
description: Every configuration input the app has - keys.json, environment files, constants - and where each one is consumed.
tags: [operations, configuration, secrets, keys]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: example
    resource: ../../keys.example.json
    title: keys.example.json
  - id: env
    resource: ../../src/environments/environment.ts
    title: environment.ts
  - id: consts
    resource: ../../src/constants/index.ts
    title: constants barrel
  - id: gitignore
    resource: ../../.gitignore
    title: .gitignore
---

# keys.json (required, untracked)

```json
{
  "CLIENT_ID": "your-google-client-id-here.apps.googleusercontent.com",
  "API_KEY": "your-google-api-key-here",
  "CLIENT_SECRET": "your-google-client-secret-here",
  "APP_ID": "your-google-cloud-project-number-here"
}
```

At the repo root, gitignored, imported as a module (`resolveJsonModule`).[^example] A missing
file or field is a build error.

| Field | Consumed by |
|---|---|
| `API_KEY` | every `SpreadsheetService` call (`key` param); `PickerService.setDeveloperKey` |
| `CLIENT_ID` | both security services' GIS clients; token exchange/refresh |
| `CLIENT_SECRET` | `RedirectSecurityService` token exchange and refresh |
| `APP_ID` | `PickerService.setAppId` (Cloud project number) |

CI writes the file from repository secrets ([GitHub Pages](../systems/github-pages.md#secrets)).
All four values ship in the JavaScript bundle ([security posture](../constraints/security-posture.md)).

# Environment files

`src/environments/environment.ts` and `environment.development.ts` (swapped by the
`development` configuration) contain only `{ production: boolean }`, and nothing in `src/`
imports them.[^env]

# Constants (`src/constants/`)

| File | Exports | Notes |
|---|---|---|
| `local-storage-keys.ts` | `SPREADSHEET_ID`, `DATA_SHEETS`, `CATEGORIES_SHEET_ID`, `CATEGORIES`, `USER`, `TOKEN`, `REFRESH_TOKEN`, `REDIRECT_TOKEN` | see [localStorage](../interfaces/local-storage.md) |
| `spreadsheets.ts` | `CATEGORIES_SHEET_TITLE = 'categories'`, `DATA_SHEET_TITLE_PREFIX = 'data_'` | changing either orphans existing spreadsheets |
| `route.ts` | `ROUTE` enum: `dashboard`, `setup`, `login`, `settings`, `categories`, `stats` (path `statistics`), `playground` | |
| `UI.ts` | `TOTAL`, `DATE_FORMAT = 'dd MMM'`, `TIME_FORMAT = 'HH:mm'`, `DATE_TIME_FORMAT = 'dd MMM HH:mm'` | |

All re-exported from `src/constants`.

# Other configuration files

| File | Purpose |
|---|---|
| `angular.json` | builders, budgets, assets, `baseHref`, test and lint targets |
| `ngsw-config.json` | service worker groups (globs relative to build output) |
| `tsconfig*.json` | compiler strictness, ambient types |
| `eslint.config.js` | lint rules |
| `vitest.config.ts` | test environment |
| `.prettierrc`, `.editorconfig` | formatting |
| `policy/sprint-window.json` | agent write-scope policy ([working agreements](../constraints/working-agreements.md)) |
| `.claude/settings.json` | agent tool permissions and hooks |

Gitignored: `keys.json`, `logs`, `dist`, `tmp`, `out-tsc`, `.angular/cache`, `coverage`.[^gitignore]

[^example]: keys.example.json
[^env]: environment.ts
[^gitignore]: .gitignore
