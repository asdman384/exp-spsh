---
type: API Client
title: Google Identity and OAuth endpoints
description: The Google Identity Services client objects and the raw OAuth/userinfo endpoints the app calls, with the exact parameters used.
tags: [interface, oauth, gis, google, auth]
resource: https://developers.google.com/identity/oauth2/web/guides/overview
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
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
  - id: gisdoc
    resource: https://developers.google.com/identity/oauth2/web/guides/migration-to-gis
    title: Migration to Google Identity Services
    author: team:google-identity-docs
---

# Library

`google.accounts.oauth2` from Google Identity Services. The library is loaded by the browser
before the app uses it; only `@types/google.accounts` appears in `package.json`. There is no
`<script>` tag for it in `index.html` — the global is expected to exist at the time a
security service is constructed, which is a latent coupling worth remembering when the app
is run in an isolated environment (tests stub or skip these paths).

A second, unrelated library — the Google Picker (`google.picker`, typed by
`@types/google.picker`) — is loaded lazily by `PickerService`
(`src/services/picker/picker.service.ts`) the first time setup opens it, via a `<script>` tag
it injects for `https://apis.google.com/js/api.js` followed by `gapi.load('picker', ...)`.
Unlike `google.accounts.oauth2`, this one is not present unconditionally on every page load,
and unlike `src/scripts/client.js` (a vendored copy of GIS), it is always fetched from
Google's own CDN.

# Client objects

| Strategy | Constructor | Config |
|---|---|---|
| Redirect | `initCodeClient` | `client_id`, `scope`, `redirect_uri: location.origin + location.pathname`, `ux_mode: 'redirect'`, `state: 'autologin'` |
| Popup | `initTokenClient` | `client_id`, `scope`, `prompt: ''`, `callback`, `error_callback` |

`scope` is always
`https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile`
(from `AbstractSecurityService.SCOPES`).[^abstract] `drive.file` grants access only to files
the user has opened or created through the app — see [Picker](#picker-flow) below for how a
spreadsheet enters that set.

# Raw HTTP endpoints

| Purpose | Call |
|---|---|
| Code exchange | `POST https://oauth2.googleapis.com/token`, form-encoded: `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`, `code` |
| Refresh | `POST https://oauth2.googleapis.com/token`, form-encoded: `client_id`, `client_secret`, `grant_type=refresh_token`, `refresh_token` |
| Profile | `GET https://content.googleapis.com/oauth2/v2/userinfo` (bearer-authenticated) |
| Revoke | `google.accounts.oauth2.revoke(access_token, cb)` |

Both token calls set `Content-Type: application/x-www-form-urlencoded` explicitly and are
**excluded from the auth interceptor** by a URL substring check on
`oauth2.googleapis.com/token`, which prevents an infinite refresh recursion.[^redirect]

# Response types

```ts
// redirect strategy
interface GoogleToken {
  access_token: string; expires_in: string; refresh_token?: string;
  scope: string; token_type: 'Bearer'; id_token: string;
}
// popup strategy uses google.accounts.oauth2.TokenResponse
```

Both are wrapped in [`Token`](../domain/sheet-and-user.md), which computes an absolute
`expiration` with a 60-second safety margin. `id_token` is stored but never validated or
decoded — identity comes from the userinfo call instead.

# Redirect round-trip parameters

Google returns to `redirect_uri` with `code`, `scope`, and `state` in the **query string**
(not the hash). Three places read them directly from `window.location`:

- `RedirectSecurityService.getCode()` — reads `code`;
- `LoginPageContainer.ngOnInit` — reads `state`, auto-logins when it contains `autologin`;
- `app.config.ts` and `logger.ts` — read `logger`.

They are stripped later by `finishSetup()` ([initial setup](../flows/initial-setup.md)).
Because the app uses hash routing, these query parameters sit *before* the `#`, which is why
`queryParamsHandling="preserve"` appears on the toolbar links.

# Picker flow

`PickerService.pickSpreadsheet()` (used from [initial setup](../flows/initial-setup.md)) gets
a current access token from `AbstractSecurityService.refreshToken()`, lazily loads the Picker
library, and opens a `PickerBuilder` restricted to `ViewId.SPREADSHEETS`, authenticated with
that token plus `keys.API_KEY` (`setDeveloperKey`) and `keys.APP_ID` (`setAppId`, the Cloud
project number). Google's Picker UI itself can browse the user's whole Drive for the purpose
of *selecting* a file — that visibility is separate from, and does not require, the app's own
OAuth scope. Only once a file is picked does `drive.file` grant the app durable access to it.
The callback reads `response[Response.ACTION]`: `Action.PICKED` resolves with the selected
file's id (`response[Response.DOCUMENTS][0][Document.ID]`), `Action.CANCEL` resolves with
`undefined`.

# Console prerequisites

The Google Cloud project behind `CLIENT_ID` must have: the Sheets API **and** the Picker API
enabled, the `drive.file` and `userinfo.profile` scopes configured on the consent screen, and
**every deployment origin plus its exact path registered as an authorized redirect URI** — the
URI is `location.origin + location.pathname`, so `https://<user>.github.io/exp-spsh/` and
`http://localhost:4200/exp-spsh/` are distinct entries.

[^abstract]: AbstractSecurityService
[^redirect]: RedirectSecurityService
