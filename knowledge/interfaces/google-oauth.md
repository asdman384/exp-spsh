---
type: API Client
title: Google Identity and OAuth endpoints
description: The Google Identity Services client objects, the Picker, and the raw OAuth/userinfo endpoints the app calls, with the exact parameters used.
tags: [interface, oauth, gis, google, auth]
resource: https://developers.google.com/identity/oauth2/web/guides/overview
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: redirect
    resource: ../../src/services/security/redirect-security.service.ts
    title: RedirectSecurityService
  - id: popup
    resource: ../../src/services/security/popup-security.service.ts
    title: PopupSecurityService
  - id: abstract
    resource: ../../src/services/security/abstract-security.service.ts
    title: AbstractSecurityService
  - id: picker
    resource: ../../src/services/picker/picker.service.ts
    title: PickerService
  - id: gis
    resource: ../../src/scripts/client.js
    title: Vendored Google Identity Services library
  - id: gisdoc
    resource: https://developers.google.com/identity/oauth2/web/guides/migration-to-gis
    title: Migration to Google Identity Services
    author: team:google-identity-docs
---

# Libraries

- **Google Identity Services** (`google.accounts.oauth2`) is vendored as
  `src/scripts/client.js` and injected as a global script by `angular.json`, so the global
  exists before any security service is constructed.[^gis]
- **Google Picker** (`google.picker`) is loaded lazily by `PickerService` the first time
  setup opens it: a `<script>` for `https://apis.google.com/js/api.js`, then
  `gapi.load('picker')`.[^picker]

# Client objects

| Strategy | Constructor | Config |
|---|---|---|
| Redirect (wired) | `initCodeClient` | `client_id`, `scope`, `redirect_uri: location.origin + location.pathname`, `ux_mode: 'redirect'`, `state: 'autologin'` |
| Popup | `initTokenClient` | `client_id`, `scope`, `prompt: ''`, `callback`, `error_callback` |

`scope` is `https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/userinfo.profile` (`AbstractSecurityService.SCOPES`).[^abstract]

# Raw endpoints

| Purpose | Call |
|---|---|
| Code exchange | `POST https://oauth2.googleapis.com/token`, form-encoded `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`, `code` |
| Refresh | `POST https://oauth2.googleapis.com/token`, form-encoded `client_id`, `client_secret`, `grant_type=refresh_token`, `refresh_token` |
| Profile | `GET https://content.googleapis.com/oauth2/v2/userinfo` (bearer) |
| Revoke | `google.accounts.oauth2.revoke(token, cb)` — the redirect strategy passes the refresh token when stored, else the access token |

The token calls are excluded from the auth interceptor by a substring match on
`oauth2.googleapis.com/token`, which prevents refresh recursion.[^redirect]

Token responses (the redirect strategy's `GoogleToken`, or GIS `TokenResponse`) are wrapped in
[`Token`](../domain/sheet-and-user.md#token). `id_token` is never decoded; identity comes from
userinfo.

# Redirect round-trip

Google returns to `redirect_uri` with `code`, `scope`, and `state` in the query string, before
the `#`. The router drops that query string on its first redirect, so it is captured once in
`initialUrlParams`:

- `RedirectSecurityService` reads `code` (and deletes it after a successful exchange);
- `LoginPageContainer` reads `state` and auto-logs-in when it contains `autologin`;
- `app.config.ts` reads `logger`.

`finishSetup()` also nulls `state`, `code`, and `scope` when navigating to the dashboard.

# Picker flow

`PickerService.pickSpreadsheet()`:[^picker]

1. `security.refreshToken()` for an access token;
2. load the Picker library (once);
3. build a `PickerBuilder` with a `DocsView(ViewId.SPREADSHEETS)` in list mode,
   `setOAuthToken(token)`, `setDeveloperKey(keys.API_KEY)`, `setAppId(keys.APP_ID)`;
4. on `Action.PICKED` emit `DOCUMENTS[0][Document.ID]`; on `Action.CANCEL` emit `undefined`.

Picking is what grants `drive.file` access to that file; `APP_ID` (the Cloud project number)
ties the grant to this app.

# Console prerequisites

In the Google Cloud project behind `CLIENT_ID`: the Sheets API and Picker API enabled; the
`drive.file` and `userinfo.profile` scopes on the consent screen; and every deployment's
`origin + pathname` registered as an authorized redirect URI —
`https://<user>.github.io/exp-spsh/` and `http://localhost:4200/exp-spsh/` are separate
entries.

[^gis]: Vendored Google Identity Services library
[^abstract]: AbstractSecurityService
[^redirect]: RedirectSecurityService
[^picker]: PickerService
