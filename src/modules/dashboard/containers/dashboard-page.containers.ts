import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, exhaustMap, first, firstValueFrom, from, map, switchMap } from 'rxjs';
import { AppActions, spreadsheetIdSelector } from 'src/@state';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.containers.html',
  styleUrl: './dashboard-page.containers.scss'
})
export class DashboardPageContainer {
  constructor(private readonly store: Store) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard' }));
  }

  async test(): Promise<void> {
    const id = await firstValueFrom(this.store.select(spreadsheetIdSelector));
    const response = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: id! });
    log(response.result);
  }
}
