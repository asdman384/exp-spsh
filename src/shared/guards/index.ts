import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';

import { Observable, combineLatest, map } from 'rxjs';

import { ROUTE } from 'src/constants';
import { NetworkStatusService, SecurityService } from 'src/services';

export function isLoggedIn(): Observable<boolean | UrlTree> {
  const securityService = inject(SecurityService);
  const router = inject(Router);
  return securityService.user$.pipe(map((user) => (user ? true : router.createUrlTree([ROUTE.setup]))));
}

export function isOnlineAndReady(): Observable<boolean | UrlTree> {
  const securityService = inject(SecurityService);
  const networkStatusService = inject(NetworkStatusService);
  const router = inject(Router);

  return combineLatest([networkStatusService.online$, securityService.gapiReady$]).pipe(
    map(([online, ready]) => (online && ready) || router.createUrlTree([]))
  );
}
