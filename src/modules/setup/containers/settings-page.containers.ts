import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { AppActions } from 'src/@state';
import { ROUTE } from 'src/constants';

@Component({
  selector: 'settings-page',
  template: `
    <div class="info">input spreadsheet id</div>
    <div class="info">
      <button mat-flat-button color="primary" (click)="next()">Next</button>
    </div>
  `,
  styles: [
    `
      .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 20px;
      }

      .mat-icon {
        height: 36px;
        width: 36px;
        font-size: 36px;
      }
    `
  ]
})
export class SettingsPageContainer {
  constructor(private readonly router: Router, private readonly store: Store) {
    this.store.dispatch(AppActions.setTitle({ title: 'Settings' }));
  }

  next(): void {
    this.router.navigate([ROUTE.dashboard]);
  }
}