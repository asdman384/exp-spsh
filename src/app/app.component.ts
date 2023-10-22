import { Component, OnInit } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SecurityService } from 'src/services';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  readonly user$ = this.securityService.user$;
  readonly loading$ = this.securityService.loading$;

  constructor(private readonly securityService: SecurityService) {}

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

  test() {
    this.loadSpreadSheetInfo().subscribe(console.log);
  }
}
