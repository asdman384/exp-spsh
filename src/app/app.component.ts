import { Component } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';

import { Store } from '@ngrx/store';
import { combineLatest, debounceTime, first, map, startWith } from 'rxjs';

import { AppActions, loadingSelector, spreadsheetIdSelector, titleSelector } from 'src/@state';
import { DATA_SHEET_TITLE_PREFIX, ROUTE } from 'src/constants';
import { SnowComponent } from 'src/fun/snow/snow.component';
import { AbstractSecurityService, NetworkStatusService, SpreadsheetService } from 'src/services';
import { UIKitModule } from 'src/shared/modules/uikit.module';

import pak from '../../package.json';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet, RouterLink, UIKitModule, SnowComponent]
})
export class AppComponent {
  protected readonly pageState$ = combineLatest({
    user: this.securityService.user$,
    online: this.networkStatus.online$,
    loading: this.store.select(loadingSelector),
    headline: this.store.select(titleSelector),
    spreadsheetId: this.store.select(spreadsheetIdSelector),
    hasUpdates: this.swUpdate.versionUpdates.pipe(
      map((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
      startWith(false)
    )
  }).pipe(debounceTime(100));

  readonly route = ROUTE;
  readonly version = pak.version;

  constructor(
    private readonly store: Store,
    private readonly router: Router,
    private readonly securityService: AbstractSecurityService,
    spreadsheetService: SpreadsheetService,
    private readonly networkStatus: NetworkStatusService,
    private readonly swUpdate: SwUpdate
  ) {
    securityService.user$.pipe(first()).subscribe((user) => {
      user && this.store.dispatch(AppActions.setCurrentSheet({ sheet: DATA_SHEET_TITLE_PREFIX + user.name }));
    });
    store
      .select(spreadsheetIdSelector)
      .pipe(first())
      .subscribe((spreadsheetId) => {
        spreadsheetId && spreadsheetService.setSpreadsheetId(spreadsheetId);
      });
  }

  logout(): void {
    this.securityService.logout();
    this.router.navigate([ROUTE.setup]);
  }

  update(): void {
    location.reload();
  }
}
