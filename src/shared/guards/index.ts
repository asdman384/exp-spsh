import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Store } from '@ngrx/store';

import { Observable, combineLatest, map } from 'rxjs';
import { categoriesSheetIdSelector, spreadsheetIdSelector } from 'src/@state';

import { ROUTE } from 'src/constants';
import { NetworkStatusService, SecurityService } from 'src/services';

export function isLoggedIn(): Observable<boolean | UrlTree> {
  const securityService = inject(SecurityService);
  const router = inject(Router);
  return securityService.user$.pipe(map((user) => (user ? true : router.createUrlTree([ROUTE.setup]))));
}

export function isOnlineAndGapiReady(): Observable<boolean | UrlTree> {
  const securityService = inject(SecurityService);
  const networkStatusService = inject(NetworkStatusService);
  const router = inject(Router);

  return combineLatest([networkStatusService.online$, securityService.gapiReady$]).pipe(
    map(([online, ready]) => (online && ready) || router.createUrlTree([]))
  );
}

export function isSetupReady(): Observable<boolean | UrlTree> {
  const store = inject(Store);
  const router = inject(Router);
  return combineLatest([store.select(spreadsheetIdSelector), store.select(categoriesSheetIdSelector)]).pipe(
    map((ids) => (ids.every((id) => id) ? true : router.createUrlTree([ROUTE.setup])))
  );
}
