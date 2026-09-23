---
type: Interface
title: ExpAuthInterceptor
description: The single HTTP choke point - it obtains a valid token before every request and attaches the bearer header.
tags: [interface, http, auth, interceptor]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: int
    resource: ../../src/http-interceptors/auth-interceptor.ts
    title: ExpAuthInterceptor
  - id: cfg
    resource: ../../src/app/app.config.ts
    title: HTTP_INTERCEPTORS registration
---

# Contract

```ts
intercept(req, next) {
  if (req.url.includes('oauth2.googleapis.com/token')) return next.handle(req);

  return this.security.refreshToken().pipe(
    take(1),
    tap(() => log(`${req.method} ${req.url}`)),
    exhaustMap((token) => next.handle(req.clone({
      setHeaders: { Authorization: `Bearer ${token.access_token}` }
    })))
  );
}
```

A class-based interceptor on `HTTP_INTERCEPTORS`, hence
`provideHttpClient(withXhr(), withInterceptorsFromDi(), ...)`.[^cfg]

# Behaviour

- **Every request waits for `refreshToken()`.** A valid stored token returns synchronously;
  an expired one holds the request until a new token arrives; with none, the redirect
  strategy navigates the page to Google and the request never completes.
- **The token endpoint is skipped**, preventing recursion when `refreshToken()` itself POSTs.
- `take(1)` matters: both strategies return long-lived subjects.
- **No response handling** — no 401 retry, no logout on auth failure. Errors reach the caller
  (effects toast; the outbox classifies them).
- Each request is logged as `"<METHOD> <url>"`, so the log overlay is a request trace.
- The token is typed loosely as `{ access_token: string }`, so one interceptor serves both
  strategies ([authentication](../flows/authentication.md)).

[^cfg]: HTTP_INTERCEPTORS registration
