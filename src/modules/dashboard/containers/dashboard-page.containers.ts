import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppActions } from 'src/@state';

@Component({
  selector: 'dashboard-page',
  template: ` DashboardPageContainer `
})
export class DashboardPageContainer {
  constructor(private readonly store: Store) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard' }));
  }
}
