import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { AppActions, spreadsheetIdSelector } from 'src/@state';
import { SecurityService } from 'src/services';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.containers.html',
  styleUrl: './dashboard-page.containers.scss'
})
export class DashboardPageContainer {
  constructor(private readonly store: Store, private readonly security: SecurityService) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard' }));
  }

  async test(): Promise<void> {}
}
