---
type: Flow
title: Authentication and token lifecycle
description: How the redirect OAuth strategy obtains, refreshes, and revokes Google tokens, and how the popup strategy differs.
tags: [flow, auth, oauth, google]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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

`AbstractSecurityService`:[^abstract]

```ts
abstract class AbstractSecurityService {
  user$: Observable<Userinfo | undefined>;           // BehaviorSubject seeded from localStorage 'user'
  login(): void;                                     // GET userinfo, store it, emit it
  logout(): void;                                    // revoke token, emit undefined, clear localStorage
  abstract refreshToken(): Observable<T>;            // a token with access_token
  protected abstract revocableToken(): string | undefined; // what logout() revokes
  protected abstract buildClient(): C;               // GIS client, built in the constructor
}
```

Scopes: `https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/userinfo.profile`. `drive.file` covers only files the user
picks through [Picker](../interfaces/google-oauth.md#picker-flow) or the app creates.

**"Logged in" means `localStorage.user` exists**, not that a token is valid. A user with an
unrefreshable token passes `isLoggedIn` and fails later at the HTTP layer.

# Redirect strategy (wired)

`initCodeClient` with `ux_mode: 'redirect'`, `redirect_uri: location.origin +
location.pathname`, `state: 'autologin'`.[^redirect] `refreshToken()`:

| State | Action |
|---|---|
| no `redirect-token`, no `code` | when online, `client.requestCode()` → full-page redirect to Google |
| no token, `code` present | POST `oauth2.googleapis.com/token` (`authorization_code`); store `redirect-token` and `refresh-token`; delete `code` from `initialUrlParams` |
| token valid (`Date.now() < expiration`) | `of(token)` |
| token expired | remove `redirect-token`; POST `refresh_token` grant if a refresh token exists, else redirect |

`code` is read from `initialUrlParams`, not from `location`. The exchange posts
`client_secret` from the browser ([security posture](../constraints/security-posture.md)).

On return, `LoginPageContainer.ngOnInit` sees `state` containing `autologin` and calls
`login()`. Its userinfo request passes through the interceptor, which performs the code
exchange first.[^login] Once `user$` emits, the login page navigates to `setup/settings`.

# Popup strategy (not wired)

`initTokenClient` plus a `ReplaySubject(1)` of token responses:[^popup]

- no client secret, no refresh token — it requests a new access token instead;
- no stored user → `requestAccessToken({})` (consent);
- expired token → `requestAccessToken({ prompt: 'none', login_hint: user.id })` when online,
  returning `skip(1)` if a token was already emitted so callers wait for the new one;
- a token error removes the stored `token` and errors the subject.

Switch strategies by changing the one `AbstractSecurityService` binding in `app.config.ts`.

# Every request asks for a token

`ExpAuthInterceptor` calls `refreshToken().pipe(take(1))` before every request except the
token endpoint, and adds `Authorization: Bearer …`.[^interceptor] A valid stored token returns
synchronously. A failed refresh errors the request, which the calling effect reports as a
toast ([interceptor](../interfaces/http-auth-interceptor.md)).

# Logout

Menu **Logout** (disabled offline) calls `logout()`: revoke the strategy's `revocableToken()` if any,
emit `undefined`, and `localStorage.clear()` — wiping `spreadsheetId`, `dataSheets`,
`categoriesSheetId`, and `categories` too, so [setup](initial-setup.md) must run again.
`AppComponent` then navigates to `setup`. The IndexedDB outbox is **not** cleared
([known issues](../constraints/known-issues.md) #25).

`revocableToken()` is per strategy:

| Strategy | Token revoked |
|---|---|
| redirect | `refresh-token`'s `refresh_token`, else `redirect-token`'s `access_token` |
| popup | `token`'s `access_token` |

The redirect strategy prefers the refresh token because revoking it revokes the whole grant,
and it is still stored after an expired `redirect-token` has been removed. The revoke call is
fire-and-forget; localStorage is cleared whatever its outcome.

[^abstract]: AbstractSecurityService
[^redirect]: RedirectSecurityService
[^popup]: PopupSecurityService
[^interceptor]: ExpAuthInterceptor
[^login]: LoginPageContainer
