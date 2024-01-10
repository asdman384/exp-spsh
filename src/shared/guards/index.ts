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
  return securityService.user$.pipe(
    map((user) => {
      if (!user) {
        log(`isLoggedIn :: user not found ${user}`);
        return router.createUrlTree([ROUTE.setup]);
      }

      log(`isLoggedIn :: user found [${user.name}]`);
      return true;
    })
  );
}

export function isOnline(): Observable<boolean | UrlTree> {
  const networkStatus = inject(NetworkStatusService);
  const router = inject(Router);

  return networkStatus.online$.pipe(map((online) => online || router.createUrlTree([])));
}

export function isGapiReady(): Observable<boolean | UrlTree> {
  const security = inject(SecurityService);
  const router = inject(Router);

  return security.gapiReady$.pipe(map((ready) => ready || router.createUrlTree([])));
}

export function isSetupReady(): Observable<boolean | UrlTree> {
  const store = inject(Store);
  const router = inject(Router);
  return combineLatest([store.select(spreadsheetIdSelector), store.select(categoriesSheetIdSelector)]).pipe(
    map((ids) => (ids.every((id) => id) ? true : router.createUrlTree([ROUTE.setup])))
  );
}
