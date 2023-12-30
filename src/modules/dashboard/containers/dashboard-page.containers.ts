import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { AppActions, sheetIdSelector, spreadsheetIdSelector } from 'src/@state';
import { SpreadsheetService } from 'src/services';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.containers.html',
  styleUrl: './dashboard-page.containers.scss'
})
export class DashboardPageContainer {
  constructor(private readonly store: Store, private readonly spreadsheetService: SpreadsheetService) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard' }));
  }

  async test(): Promise<void> {
    const sheetId = await firstValueFrom(this.store.select(sheetIdSelector));
    const spreadsheetId = await firstValueFrom(this.store.select(spreadsheetIdSelector));

    this.spreadsheetService.prependRow(spreadsheetId!, sheetId!).then((res) => log(res));
  }
}
