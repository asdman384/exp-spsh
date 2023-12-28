import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Store } from '@ngrx/store';

import { titleSelector } from 'src/@state';
import { ROUTE } from 'src/constants';
import { NetworkStatusService, SecurityService } from 'src/services';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  readonly route = ROUTE;
  readonly user$ = this.securityService.user$;
  readonly loading$ = this.securityService.loading$;
  readonly isOnline$ = this.status.online$;
  readonly title$ = this.store.select(titleSelector);

  constructor(
    private readonly store: Store,
    private readonly router: Router,
    private readonly securityService: SecurityService,
    private readonly sw: SwUpdate,
    private readonly status: NetworkStatusService
  ) {
    this.sw.versionUpdates.subscribe((v) => log(v.type));
  }

  ngOnInit(): void {}

  logout(): void {
    this.securityService.logout();
    this.router.navigate([ROUTE.setup]);
  }
}
