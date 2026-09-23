---
type: External System
title: Google Sheets and Identity (the backend)
description: The external system that stores all application data and authenticates users, plus the console configuration it requires.
tags: [system, google, sheets, oauth, dependency]
resource: https://console.cloud.google.com/
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService endpoints
  - id: keys
    resource: ../../keys.example.json
    title: keys.json template
  - id: picker
    resource: ../../src/services/picker/picker.service.ts
    title: PickerService
---

Google is not an integration here — it **is** the backend.

# Hosts contacted at runtime

| Host | Used for |
|---|---|
| `content-sheets.googleapis.com` | Sheets v4 REST ([interface](../interfaces/google-sheets-api.md)) |
| `docs.google.com` | `gviz/tq` expense reads ([interface](../interfaces/gviz-query.md)) |
| `content.googleapis.com` | `oauth2/v2/userinfo` |
| `oauth2.googleapis.com` | token exchange and refresh |
| `accounts.google.com` | GIS consent/redirect (library bundled as `src/scripts/client.js`) |
| `apis.google.com` | Picker library, loaded lazily during setup |

Only the first and third are in the service worker's `dataGroups` (zero caching).

# Cloud configuration

One Google Cloud project supplies an OAuth **Web application** client, an API key, and the
project number, delivered as `keys.json`:[^keys]

```json
{ "CLIENT_ID": "...apps.googleusercontent.com", "API_KEY": "...", "CLIENT_SECRET": "...", "APP_ID": "..." }
```

`APP_ID` is the numeric **project number** (not the project id), passed to
`PickerBuilder.setAppId()`.[^picker]

Required settings:

- Google Sheets API and Google Picker API enabled.
- Consent screen scopes `.../auth/drive.file` and `.../auth/userinfo.profile`.
- Authorized redirect URIs equal to `location.origin + location.pathname` for every
  environment, and matching JavaScript origins.
- While the consent screen is in *testing* mode, refresh tokens expire after seven days and
  users must be listed as testers — a common cause of repeated logouts.

# Data ownership

- The spreadsheet belongs to the user. The signed-in account needs **edit** access; the app
  sees only files picked through Picker or created by it (`drive.file`).
- Users edit rows directly in Google Sheets, which is why delete re-reads before acting and
  why positional deletion is fragile ([delete](../flows/delete-expense.md)).
- The data outlives the app.
- Quotas are per Cloud project, shared by every user of a deployment.

[^keys]: keys.json template
[^picker]: PickerService
