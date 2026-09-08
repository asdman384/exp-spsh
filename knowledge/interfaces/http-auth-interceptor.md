---
type: Interface
title: ExpAuthInterceptor
description: The single HTTP choke point - it refreshes a token before every request and attaches the bearer header.
tags: [interface, http, auth, interceptor]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
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
  if (req.url.includes('oauth2.googleapis.com/token')) return next.handle(req);   // escape hatch

  return this.security.refreshToken().pipe(
    take(1),
    tap(() => log(`${req.method} ${req.url}`)),
    exhaustMap((token) => next.handle(req.clone({
      setHeaders: { Authorization: `Bearer ${token.access_token}` }
    })))
  );
}
```

It is a class-based interceptor registered as a multi-provider on `HTTP_INTERCEPTORS`, which
is why the app calls `provideHttpClient(withInterceptorsFromDi())`.[^cfg]

# Behaviour worth knowing

- **Every request awaits `refreshToken()`.** With a valid stored token that resolves
  synchronously (`of(token)`), so the cost is negligible; with an expired one the request is
  held until a new token arrives, and with no token at all the redirect strategy navigates
  the whole page away to Google — an in-flight request simply never completes.
- **The token endpoint is excluded by substring match**, preventing infinite recursion when
  `refreshToken()` itself performs the exchange.
- `take(1)` is essential: `refreshToken()` returns long-lived subjects in both strategies.
- **No response handling.** There is no 401 retry, no error mapping, and no logout on
  auth failure — a rejected request propagates to the caller, where effects swallow it.
- It logs `"<METHOD> <url>"` for every request into the on-page logger, which makes the
  logger overlay an effective request trace during debugging.
- `refreshToken()` is typed loosely here as `{ access_token: string }`, which is what lets
  the same interceptor serve both security strategies
  ([authentication](../flows/authentication.md)).

[^cfg]: HTTP_INTERCEPTORS registration
