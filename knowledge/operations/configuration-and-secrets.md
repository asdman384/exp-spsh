---
type: Reference
title: Configuration and secrets
description: Every configuration input the app has - keys.json, environment files, constants - and where each one is consumed.
tags: [operations, configuration, secrets, keys]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
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
  "CLIENT_SECRET": "your-google-client-secret-here"
}
```

Lives at the **repository root**, gitignored, imported directly as a module
(`import keys from '../../../keys.json'`) thanks to `resolveJsonModule`.[^example]

| Field | Consumed by |
|---|---|
| `API_KEY` | every `SpreadsheetService` call, as the `key` query parameter |
| `CLIENT_ID` | both security services, when constructing the GIS client |
| `CLIENT_SECRET` | `RedirectSecurityService` only, in the token exchange and refresh |

Missing file ⇒ the build cannot resolve the import. In CI the file is written from
repository secrets ([CI](ci-and-deployment.md)). Note the security implication:
these values ship inside the JavaScript bundle
([security posture](../constraints/security-posture.md)).

# Environment files

`src/environments/environment.ts` (production) and `environment.development.ts`, swapped by
the `development` build configuration's `fileReplacements`. They differ **only** in the
`production` boolean. Both declare `SHEETS_DISCOVERY_DOC`, `OAUTH2_DISCOVERY_DOC`, and
`SCOPES` — **none of which are referenced anywhere in `src/`**; the effective scopes live in
`AbstractSecurityService.SCOPES`.[^env] Treat these files as vestigial when changing scopes.

# Constants (`src/constants/`)

| File | Exports | Notes |
|---|---|---|
| `local-storage-keys.ts` | `SPREADSHEET_ID`, `DATA_SHEETS`, `CATEGORIES_SHEET_ID`, `CATEGORIES`, `USER`, `TOKEN`, `REFRESH_TOKEN`, `REDIRECT_TOKEN` | also used as setup form control names |
| `spreadsheets.ts` | `CATEGORIES_SHEET_TITLE = 'categories'`, `DATA_SHEET_TITLE_PREFIX = 'data_'` | changing either breaks existing spreadsheets |
| `route.ts` | `ROUTE` enum: `dashboard`, `setup`, `login`, `settings`, `categories`, `stats` (= `'statistics'`), `playground` | note `stats` maps to the path `statistics` |
| `UI.ts` | `TOTAL`, `BACK`, `DATE_FORMAT = 'dd MMM'`, `TIME_FORMAT = 'HH:mm'`, `DATE_TIME_FORMAT = 'dd MMM HH:mm'` | `BACK` is currently unused |

All are re-exported from `src/constants/index.ts` and imported as `src/constants`.

# Other configuration files

| File | Purpose |
|---|---|
| `angular.json` | builders, budgets, assets, test target |
| `ngsw-config.json` | service worker asset and data groups (hard-codes `/exp-spsh/`) |
| `tsconfig*.json` | compiler strictness and ambient types |
| `vitest.config.ts` | test environment |
| `.prettierrc`, `.editorconfig` | formatting |
| `policy/sprint-window.json` | agent write-scope policy ([working agreements](../constraints/working-agreements.md)) |
| `.claude/settings.json` | tool permissions for agent sessions |

`logs/` and `keys.json` are gitignored; `dist/` and `.angular/cache` too.[^gitignore]

[^example]: keys.example.json
[^env]: environment.ts
[^gitignore]: .gitignore
