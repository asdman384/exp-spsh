import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { AppActions, sheetIdSelector, spreadsheetIdSelector } from 'src/@state';
import { SpreadsheetService } from 'src/services';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.container.html',
  styleUrl: './dashboard-page.container.scss'
})
export class DashboardPageContainer {
  constructor(private readonly store: Store, private readonly spreadsheetService: SpreadsheetService) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard' }));
  }

  async append(): Promise<void> {
    const spreadsheetId = await firstValueFrom(this.store.select(spreadsheetIdSelector));
    const sheetId = await firstValueFrom(this.store.select(sheetIdSelector));

    this.spreadsheetService.prependRow(spreadsheetId!, sheetId!).then((res) => log(res));
  }

  async get(): Promise<void> {
    const spreadsheetId = await firstValueFrom(this.store.select(spreadsheetIdSelector));
    const sheetId = await firstValueFrom(this.store.select(sheetIdSelector));

    this.spreadsheetService.getData(spreadsheetId!, sheetId!);
  }
}
