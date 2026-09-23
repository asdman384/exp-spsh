---
type: Constraint
title: Security posture
description: What a backend-less design implies here - a client secret in the bundle, an API key in every URL, and tokens in localStorage - stated plainly with the mitigations that do exist.
tags: [constraints, security, oauth, secrets]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: redirect
    resource: ../../src/services/security/redirect-security.service.ts
    title: RedirectSecurityService token exchange
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: API key usage
  - id: wf
    resource: ../../.github/workflows/webpack.yml
    title: keys.json assembly in CI
---

Properties of the current design, not necessarily defects — for a personal expense tracker
the trade-offs may be deliberate — but any change of audience should revisit them.

# 1. `CLIENT_SECRET` ships in the bundle

The redirect strategy exchanges the authorization code **from the browser**, posting
`client_id` + `client_secret` to `oauth2.googleapis.com/token`.[^redirect] CI writes the
secret into `keys.json`, and the bundler inlines it.[^wf] Anyone can read it from the
published site. Removing it needs PKCE with a public client or a token-exchange backend; the
existing `PopupSecurityService` needs no secret and is the smaller step.

# 2. `API_KEY` on every Sheets request

Every `SpreadsheetService` call sends `key: keys.API_KEY`, and Picker uses it too.[^svc]
Restrict the key by HTTP referrer and API in the Cloud console, or the published key can
consume the project's quota.

# 3. Tokens and data in browser storage

`token`, `redirect-token`, and the long-lived `refresh-token` are plain JSON in localStorage
([storage](../interfaces/local-storage.md)); any XSS on the origin reads them. Logout revokes the
grant (the refresh token under the wired redirect strategy) and clears localStorage
([authentication](../flows/authentication.md#logout)). Queued expenses sit unencrypted in IndexedDB and
survive logout (#25). Access tokens are treated as expired 60 s early.

# 4. "Logged in" is a localStorage flag

`isLoggedIn` checks for a stored `user`, not a valid session. It is a routing convenience; the
real boundary is Google's, per request. That holds as long as nothing sensitive is gated only
client-side.

# 5. Scope is narrowed to the picked file

`drive.file` gives access only to the spreadsheet picked through Google Picker (or files the
app creates), not every spreadsheet the account owns
([Picker flow](../interfaces/google-oauth.md#picker-flow)).

# Done well

- gviz dates are parsed with an anchored regex, never `eval`
  ([date encoding](../domain/spreadsheet-layout.md#date-encoding)).
- The gviz query interpolates only numbers from `Date` getters.
- Spreadsheet ranges are `encodeURIComponent`-escaped.
- `keys.json` is gitignored; `.claude/settings.json` denies agents reading it.
- The service worker never caches API responses.
- The external spreadsheet link uses `rel="noopener noreferrer"`.

[^redirect]: RedirectSecurityService token exchange
[^svc]: API key usage
[^wf]: keys.json assembly in CI
