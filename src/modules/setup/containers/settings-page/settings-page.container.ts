import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, firstValueFrom } from 'rxjs';

import { AppActions, sheetIdSelector, spreadsheetIdSelector } from 'src/@state';
import { ROUTE, SHEET_ID, SPREADSHEET_ID } from 'src/constants';
import { SecurityService, SpreadsheetService } from 'src/services';

type State = 'check document' | 'finish';

@Component({
  selector: 'settings-page',
  templateUrl: './settings-page.container.html',
  styleUrl: './settings-page.container.scss'
})
export class SettingsPageContainer {
  readonly spreadsheetIdField = SPREADSHEET_ID;
  readonly sheetIdField = SHEET_ID;
  readonly spreadsheetId: Observable<string | undefined> = this.store.select(spreadsheetIdSelector);
  readonly sheetId: Observable<number | undefined> = this.store.select(sheetIdSelector);
  loading: boolean = false;
  state: State = 'check document';

  constructor(
    private readonly router: Router,
    private readonly security: SecurityService,
    private readonly spreadsheetService: SpreadsheetService,
    private readonly store: Store
  ) {
    this.store.dispatch(AppActions.setTitle({ title: 'Settings' }));
  }

  async checkSetup(form: NgForm, state: State): Promise<void> {
    if (state === 'finish') {
      this.finishSetup();
      return;
    }

    if (!form.valid) return;
    const spreadsheetId = form.value[this.spreadsheetIdField];
    this.loading = true;

    const spreadsheet = await this.spreadsheetService.getSpreadsheet(spreadsheetId);

    if (spreadsheet.spreadsheetId === undefined) {
      throw 'error getting spreadsheet';
    }

    log('loaded spreadsheet ' + spreadsheet.spreadsheetId);
    this.store.dispatch(AppActions.spreadsheetId({ spreadsheetId: spreadsheet.spreadsheetId }));

    const user = await firstValueFrom(this.security.user$);
    log('user ' + user?.id);
    const sheet = spreadsheet.sheets?.find((s) => s.properties?.title === user?.id);
    let sheetId: number | undefined = sheet?.properties?.sheetId;
    if (!sheet && user && user.id) {
      log('sheet creation');
      sheetId = await this.addSheet(user.id, spreadsheetId);
      log(`sheet created sheetId: ${sheetId}`);
    } else {
      log(`sheet exists: ${sheetId}`);
    }

    if (sheetId === undefined) {
      throw 'error getting sheet';
    }

    this.store.dispatch(AppActions.sheetId({ sheetId }));

    log('sheet format adjust');
    const formats = await this.spreadsheetService.setSheetFormats(spreadsheet.spreadsheetId, sheetId);
    log('sheet format adjust finish');
    log(formats);

    this.state = 'finish';
    this.loading = false;
  }

  private finishSetup(): void {
    this.router.navigate([ROUTE.dashboard], { replaceUrl: true, queryParamsHandling: 'preserve' });
  }

  private async addSheet(title: string, spreadsheetId: string): Promise<number | undefined> {
    return this.spreadsheetService.addSheet(title, spreadsheetId).then((sheet) => sheet?.sheetId);
  }
}
