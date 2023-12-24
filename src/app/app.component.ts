import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Store } from '@ngrx/store';

import { Observable, from, map } from 'rxjs';
import { selectTitle } from 'src/@state';
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
  readonly title$ = this.store.select(selectTitle);

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

  loadSpreadSheetInfo(): Observable<gapi.client.sheets.Spreadsheet> {
    // const settings = this.storage.get(Settings);
    const settings = {
      sheetId: '1rS5ed2apOUNN7vGwtuv_B7mQQFgrQXVkXm83lGi8y90'
    };

    return from(gapi.client.sheets.spreadsheets.get({ spreadsheetId: settings.sheetId })).pipe(
      map((response) => response.result)
    );
  }

  logout(): void {
    this.securityService.logout();
    this.router.navigate([ROUTE.setup]);
  }

  test(): void {
    this.loadSpreadSheetInfo().subscribe({ next: log, error: (e) => log(e) });
  }
}
