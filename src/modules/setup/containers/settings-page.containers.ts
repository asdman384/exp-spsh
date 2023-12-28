import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import { AppActions, spreadsheetIdSelector } from 'src/@state';
import { ROUTE, SPREADSHEET_ID } from 'src/constants';

@Component({
  selector: 'settings-page',
  template: `
    <div class="info">
      <form #form="ngForm">
        <mat-form-field appearance="outline" style="width: 510px;">
          <mat-label>Spreadsheet id</mat-label>
          <input [name]="spreadsheetIdField" matInput [ngModel]="spreadsheetId | async" [required]="true" />
          <mat-icon matSuffix>help_outline</mat-icon>
        </mat-form-field>
      </form>
      <button mat-flat-button color="primary" (click)="next(form)" [disabled]="!form.valid">Finish</button>
    </div>
  `,
  styles: [
    `
      .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin-top: 20px;
      }
    `
  ]
})
export class SettingsPageContainer {
  readonly spreadsheetIdField = SPREADSHEET_ID;
  readonly spreadsheetId: Observable<string | null> = this.store.select(spreadsheetIdSelector);

  constructor(private readonly router: Router, private readonly store: Store) {
    this.store.dispatch(AppActions.setTitle({ title: 'Settings' }));
  }

  next(form: NgForm): void {
    if (!form.valid) return;
    this.store.dispatch(AppActions.spreadsheetId({ spreadsheetId: form.value[this.spreadsheetIdField] }));
    this.router.navigate([ROUTE.dashboard], { replaceUrl: true, queryParamsHandling: 'preserve' });
  }
}
