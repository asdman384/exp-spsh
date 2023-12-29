import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, firstValueFrom } from 'rxjs';

import { AppActions, spreadsheetIdSelector } from 'src/@state';
import { ROUTE, SPREADSHEET_ID } from 'src/constants';
import { SecurityService } from 'src/services';

@Component({
  selector: 'settings-page',
  template: `
    <div class="info">
      <form #form="ngForm">
        <mat-form-field appearance="outline" style="width: 480px;">
          <mat-label>Spreadsheet id</mat-label>
          <input [name]="spreadsheetIdField" matInput [ngModel]="spreadsheetId | async" [required]="true" />
          <mat-icon matSuffix>help_outline</mat-icon>
        </mat-form-field>
      </form>
      <button mat-flat-button color="primary" (click)="finishSetup(form)" [disabled]="!form.valid">Finish</button>
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

  constructor(
    private readonly router: Router,
    private readonly security: SecurityService,
    private readonly store: Store
  ) {
    this.store.dispatch(AppActions.setTitle({ title: 'Settings' }));
  }

  async finishSetup(form: NgForm): Promise<void> {
    if (!form.valid) return;
    const spreadsheetId = form.value[this.spreadsheetIdField];
    this.store.dispatch(AppActions.spreadsheetId({ spreadsheetId }));
    const response = await gapi.client.sheets.spreadsheets.get({ spreadsheetId });
    log('spreadsheet', response.result);
    const user = await firstValueFrom(this.security.user$);
    log('user', user);
    const sheet = response.result.sheets?.find((s) => s.properties?.title === user?.id);

    if (!sheet && user && user.id) {
      this.addSheet(user.id, spreadsheetId);
    } else {
      log('sheet exists', sheet);
    }

    // this.router.navigate([ROUTE.dashboard], { replaceUrl: true, queryParamsHandling: 'preserve' });
  }

  private addSheet(title: string, spreadsheetId: string): void {
    gapi.client.sheets.spreadsheets
      .batchUpdate({
        spreadsheetId,
        resource: { requests: [{ addSheet: { properties: { title } } }] }
      })
      .then((response) => {
        log(response.result);
      })
      .catch((e) => log(e));
  }
}
