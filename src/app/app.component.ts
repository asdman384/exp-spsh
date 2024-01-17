import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';

import { Store } from '@ngrx/store';
import { first, map } from 'rxjs';

import { AppActions, loadingSelector, spreadsheetIdSelector, titleSelector } from 'src/@state';
import { DATA_SHEET_TITLE_PREFIX, ROUTE } from 'src/constants';
import { NetworkStatusService, SecurityService, SpreadsheetService } from 'src/services';

import pak from '../../package.json';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  readonly route = ROUTE;
  readonly user$ = this.securityService.user$;
  readonly loading$ = this.store.select(loadingSelector);
  readonly isOnline$ = this.networkStatus.online$;
  readonly headline$ = this.store.select(titleSelector);
  readonly spreadsheetId$ = this.store.select(spreadsheetIdSelector);
  readonly hasUpdates$ = this.swUpdate.versionUpdates.pipe(
    map((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
  );
  readonly version = pak.version;

  constructor(
    private readonly store: Store,
    private readonly router: Router,
    private readonly activeRoute: ActivatedRoute,
    private readonly securityService: SecurityService,
    spreadsheetService: SpreadsheetService,
    private readonly networkStatus: NetworkStatusService,
    private readonly swUpdate: SwUpdate
  ) {
    this.securityService.user$.pipe(first()).subscribe((user) => {
      user && this.store.dispatch(AppActions.setCurrentSheet({ sheet: DATA_SHEET_TITLE_PREFIX + user.name }));
    });
    this.spreadsheetId$.pipe(first()).subscribe((spreadsheetId) => {
      spreadsheetId && spreadsheetService.setSpreadsheetId(spreadsheetId);
    });
  }

  enableDebug(): void {
    const enabled = this.activeRoute.snapshot.queryParams['logger'];
    this.router
      .navigate([], {
        queryParams: { logger: enabled ? undefined : 'window' },
        replaceUrl: true
      })
      .then(() => location.reload());
  }

  logout(): void {
    this.securityService.logout();
    this.router.navigate([ROUTE.setup]);
  }

  update(): void {
    location.reload();
  }
}
