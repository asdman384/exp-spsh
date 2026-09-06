---
type: External System
title: Google Sheets and Identity (the backend)
description: The external system that stores all application data and authenticates users, plus the console configuration it requires.
tags: [system, google, sheets, oauth, dependency]
resource: https://console.cloud.google.com/
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService endpoints
  - id: keys
    resource: ../../keys.example.json
    title: keys.json template
  - id: env
    resource: ../../src/environments/environment.ts
    title: Environment discovery docs
---

Google is not an integration in this app — it **is** the backend. There is no other
persistence tier.

# Hosts contacted at runtime

| Host | Used for |
|---|---|
| `content-sheets.googleapis.com` | all Sheets v4 REST calls ([interface](/interfaces/google-sheets-api.md)) |
| `docs.google.com` | the `gviz/tq` read path ([interface](/interfaces/gviz-query.md)) |
| `content.googleapis.com` | `oauth2/v2/userinfo` |
| `oauth2.googleapis.com` | token exchange and refresh |
| Google Identity Services | the `google.accounts.oauth2` client library |

The first three are the ones listed in the service worker `dataGroups` with caching disabled.

# Cloud console configuration

The app needs an OAuth 2.0 **Web application** client and an API key in one Google Cloud
project, delivered to the build as `keys.json`:[^keys]

```json
{ "CLIENT_ID": "...apps.googleusercontent.com", "API_KEY": "...", "CLIENT_SECRET": "..." }
```

Required project settings:

- **Google Sheets API enabled.**
- Consent screen with the scopes `.../auth/spreadsheets` and `.../auth/userinfo.profile`.
- **Authorized redirect URIs** matching `location.origin + location.pathname` for every
  environment (production Pages URL and `http://localhost:4200/exp-spsh/`).
- Authorized JavaScript origins for the same hosts.
- While the consent screen is in *testing* mode, refresh tokens expire after seven days and
  every user must be listed as a test user — a common cause of "it logged me out again".

`environment.ts` also lists `SHEETS_DISCOVERY_DOC` and `OAUTH2_DISCOVERY_DOC`; **neither is
used** — a leftover from a `gapi.client` era.[^env]

# Data ownership

The spreadsheet belongs to the end user, not to the project. Consequences:

- The signed-in account needs **edit** access; read-only access fails at the first
  `batchUpdate` in setup.
- Users can (and do) edit rows directly in Google Sheets, which is why several flows re-read
  before writing, and why row-index-based deletion is fragile
  ([delete](/flows/delete-expense.md)).
- Uninstalling the app loses nothing; the data outlives it.
- Quotas are per project (`API_KEY` / `CLIENT_ID`), so all users of a given deployment share
  the Sheets API rate limits.

[^keys]: keys.json template
[^env]: Environment discovery docs
