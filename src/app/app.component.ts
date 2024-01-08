import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';

import { Store } from '@ngrx/store';
import { exhaustMap, filter, first } from 'rxjs';

import { AppActions, loadingSelector, spreadsheetIdSelector, titleSelector } from 'src/@state';
import { DATA_SHEET_TITLE_PREFIX, ROUTE } from 'src/constants';
import { NetworkStatusService, SecurityService } from 'src/services';
import { DialogComponent } from 'src/shared/components';

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
  readonly title$ = this.store.select(titleSelector);
  readonly spreadsheetId$ = this.store.select(spreadsheetIdSelector);

  constructor(
    private readonly store: Store,
    private readonly router: Router,
    private readonly activeRoute: ActivatedRoute,
    private readonly securityService: SecurityService,
    private readonly networkStatus: NetworkStatusService,
    private readonly dialog: MatDialog,
    private readonly swUpdate: SwUpdate
  ) {
    this.securityService.user$.pipe(first()).subscribe((user) => {
      user && this.store.dispatch(AppActions.setCurrentSheet({ sheet: DATA_SHEET_TITLE_PREFIX + user.name }));
    });
    this.subscribeForUpdates();
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

  private subscribeForUpdates(): void {
    const data = { title: 'New version is ready', content: 'Update to the latest version?' };
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .pipe(exhaustMap(() => this.dialog.open(DialogComponent, { data }).afterClosed()))
      .subscribe((result: boolean) => result && location.reload());
  }
}
