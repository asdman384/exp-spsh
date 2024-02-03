import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpHandler, HttpRequest, HttpEvent } from '@angular/common/http';

import { Observable, exhaustMap, take, tap } from 'rxjs';

import { AbstractSecurityService } from 'src/services';

@Injectable()
export class ExpAuthInterceptor implements HttpInterceptor {
  constructor(private security: AbstractSecurityService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.url.includes('oauth2.googleapis.com/token')) {
      return next.handle(req);
    }

    // send cloned request with header to the next handler.
    return this.security.refreshToken().pipe(
      take(1),
      tap(() => log(`${req.method} ${req.url}`)),
      exhaustMap((token) => next.handle(setToken(req, token)))
    );
  }
}

function setToken(req: HttpRequest<any>, token: { access_token: string }): HttpRequest<any> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token.access_token}` } });
}
