import { Component, OnInit } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { Observable, from, map } from 'rxjs';
import { NetworkStatusService, SecurityService } from 'src/services';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  readonly user$ = this.securityService.user$;
  readonly loading$ = this.securityService.loading$;
  readonly version$ = this.sw.versionUpdates;
  readonly isOnline$ = this.status.online$;

  constructor(
    private readonly securityService: SecurityService,
    private readonly sw: SwUpdate,
    private readonly status: NetworkStatusService
  ) {}

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
  }

  test(): void {
    this.loadSpreadSheetInfo().subscribe({ next: log, error: (e) => log(e) });
  }
}
