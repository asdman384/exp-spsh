import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { first } from 'rxjs';

import { AppActions, loadingSelector, spreadsheetIdSelector, titleSelector } from 'src/@state';
import { DATA_SHEET_TITLE_PREFIX, ROUTE } from 'src/constants';
import { NetworkStatusService, SecurityService } from 'src/services';

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
    private readonly securityService: SecurityService,
    private readonly networkStatus: NetworkStatusService
  ) {
    this.securityService.user$.pipe(first()).subscribe((user) => {
      user && this.store.dispatch(AppActions.setCurrentSheet({ sheet: DATA_SHEET_TITLE_PREFIX + user.name }));
    });
  }

  logout(): void {
    this.securityService.logout();
    this.router.navigate([ROUTE.setup]);
  }
}
