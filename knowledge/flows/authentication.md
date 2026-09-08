---
type: Flow
title: Authentication and token lifecycle
description: How the redirect OAuth strategy obtains, refreshes, and revokes Google tokens, and how the popup strategy differs.
tags: [flow, auth, oauth, google]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: abstract
    resource: ../../src/services/security/abstract-security.service.ts
    title: AbstractSecurityService
  - id: redirect
    resource: ../../src/services/security/redirect-security.service.ts
    title: RedirectSecurityService
  - id: popup
    resource: ../../src/services/security/popup-security.service.ts
    title: PopupSecurityService
  - id: interceptor
    resource: ../../src/http-interceptors/auth-interceptor.ts
    title: ExpAuthInterceptor
  - id: login
    resource: ../../src/modules/setup/login-page.containers.ts
    title: LoginPageContainer
---

# The contract

`AbstractSecurityService` defines what the rest of the app may rely on:[^abstract]

```ts
user$: Observable<Userinfo | undefined>   // BehaviorSubject seeded from localStorage 'user'
login(): void                             // GET userinfo, store it, emit it
logout(): void                            // revoke token, clear user, clear all storage
abstract refreshToken(): Observable<T>    // returns a token with an access_token
protected abstract buildClient(): C       // constructs the GIS client, called in the ctor
```

Requested scopes are
`https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile`.
Note that `environment.ts` also declares a `SCOPES` constant with only the spreadsheets
scope — **it is unused**; the service constant is the effective one.

**"Logged in" means `localStorage.user` exists.** Not a valid token — the profile object.
`isLoggedIn` guards on `user$`, so a user with an expired, unrefreshable token still passes
the guard and fails later at the HTTP layer.

# Redirect strategy (the wired default)

`RedirectSecurityService` uses `google.accounts.oauth2.initCodeClient` with
`ux_mode: 'redirect'`, `redirect_uri: location.origin + location.pathname`, and
`state: 'autologin'`.[^redirect] `refreshToken()` is a four-branch decision:

| State | Action |
|---|---|
| no `redirect-token`, no `?code=` | wait for online, then `client.requestCode()` -> full page redirect to Google |
| no token, `?code=` present | POST `oauth2.googleapis.com/token` with `grant_type=authorization_code`; store `redirect-token` and `refresh-token` |
| token present and `Date.now() < expiration` | return it directly (`of(token)`) |
| token expired | drop `redirect-token`; if a `refresh-token` exists POST `grant_type=refresh_token`, else redirect for a new code |

The code exchange sends `client_id`, **`client_secret`**, `redirect_uri`, and `code` as
`application/x-www-form-urlencoded` — from the browser. See
[security posture](../constraints/security-posture.md).

On return from Google, `LoginPageContainer.ngOnInit` reads `state` from the URL and, if it
contains `autologin`, calls `login()` automatically, which fetches
`https://content.googleapis.com/oauth2/v2/userinfo` (itself intercepted, so the code
exchange happens as a side effect of that first request).[^login]

# Popup strategy (available, not wired)

`PopupSecurityService` uses `initTokenClient` and a `ReplaySubject(1)` of token
responses.[^popup] Differences worth knowing:

- No client secret and no refresh token — it re-requests an access token instead.
- With no stored user it calls `requestAccessToken({})` (full consent).
- With an expired token it calls `requestAccessToken({ prompt: 'none', login_hint: user.id })`
  for a silent refresh, and returns `token$.pipe(skip(1))` when a token was already emitted
  so the caller waits for the *new* one.
- Token errors push `token.error(...)` and remove the stored `token` key.

To switch strategies, change the single `{ provide: AbstractSecurityService, useClass: ... }`
binding in `app.config.ts` ([dependency wiring](../architecture/dependency-wiring.md)).

# Every request refreshes

`ExpAuthInterceptor` wraps **all** outgoing requests except the token endpoint itself:[^interceptor]

```
req --> (url contains 'oauth2.googleapis.com/token') ? passthrough
     --> security.refreshToken().pipe(take(1)) --> clone with Authorization: Bearer <access_token> --> next
```

So the token check runs per request; the strategy's caching (a valid stored token returns
synchronously via `of(...)`) is what keeps this cheap. A failing refresh causes the request
observable to error, which each effect swallows in its `catchError`.

# Logout

`logout()` revokes the access token through `google.accounts.oauth2.revoke(...)`, clears
`user$`, and calls `storageService.clear()` — which wipes **all** localStorage, including
`spreadsheetId`, `dataSheets`, `categoriesSheetId`, and `categories`. Logging out therefore
resets the app to a state where `isSetupReady` fails and the user must re-run
[setup](initial-setup.md). `AppComponent.logout()` then navigates to `setup`.

[^abstract]: AbstractSecurityService
[^redirect]: RedirectSecurityService
[^popup]: PopupSecurityService
[^interceptor]: ExpAuthInterceptor
[^login]: LoginPageContainer
