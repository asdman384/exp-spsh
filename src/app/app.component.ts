import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { loadingSelector, titleSelector } from 'src/@state';
import { ROUTE } from 'src/constants';
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

  constructor(
    private readonly store: Store,
    private readonly router: Router,
    private readonly securityService: SecurityService,
    private readonly networkStatus: NetworkStatusService
  ) {}

  logout(): void {
    this.securityService.logout();
    this.router.navigate([ROUTE.setup]);
  }
}
