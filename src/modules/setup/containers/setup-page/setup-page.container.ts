import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, firstValueFrom } from 'rxjs';

import { AppActions, categoriesSheetIdSelector, sheetIdSelector, spreadsheetIdSelector } from 'src/@state';
import { CATEGORIES_SHEET_ID, CATEGORIES_SHEET_TITLE, ROUTE, SHEET_ID, SPREADSHEET_ID } from 'src/constants';
import { SecurityService, SpreadsheetService } from 'src/services';

type State = 'check document' | 'finish';

@Component({
  selector: 'setup-page',
  templateUrl: './setup-page.container.html',
  styleUrl: './setup-page.container.scss'
})
export class SettingsPageContainer {
  readonly spreadsheetIdField = SPREADSHEET_ID;
  readonly sheetIdField = SHEET_ID;
  readonly categoriesSheetIdField = CATEGORIES_SHEET_ID;
  readonly spreadsheetId: Observable<string | undefined> = this.store.select(spreadsheetIdSelector);
  readonly sheetId: Observable<number | undefined> = this.store.select(sheetIdSelector);
  readonly categoriesSheetId: Observable<number | undefined> = this.store.select(categoriesSheetIdSelector);
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
    const spreadsheetId: string = form.value[this.spreadsheetIdField];
    const user = await firstValueFrom(this.security.user$);
    if (!user || !user.id) {
      throw 'error getting user';
    }

    this.loading = true;

    const spreadsheet = await this.loadSpreadSheet(spreadsheetId);
    const dataSheetId = await this.createSheet(user.id, 4, spreadsheet);
    this.store.dispatch(AppActions.sheetId({ sheetId: dataSheetId }));
    const categoriesSheetId = await this.createSheet(CATEGORIES_SHEET_TITLE, 2, spreadsheet);
    this.store.dispatch(AppActions.categoriesSheetId({ categoriesSheetId }));

    log('categories sheet format adjust');
    await this.spreadsheetService.setCategoriesSheetFormats(spreadsheet.spreadsheetId!, categoriesSheetId);
    log('categories sheet format adjust finish');
    log('data sheet format adjust');
    await this.spreadsheetService.setDataSheetFormats(spreadsheet.spreadsheetId!, dataSheetId);
    log('data sheet format adjust finish');

    this.loading = false;
    this.state = 'finish';
  }

  private async loadSpreadSheet(spreadsheetId: string): Promise<gapi.client.sheets.Spreadsheet> {
    const spreadsheet = await this.spreadsheetService.getSpreadsheet(spreadsheetId);
    if (spreadsheet.spreadsheetId === undefined) {
      throw 'error getting spreadsheet';
    }

    log('loaded spreadsheet ' + spreadsheet.spreadsheetId);
    this.store.dispatch(AppActions.spreadsheetId({ spreadsheetId: spreadsheet.spreadsheetId }));

    return spreadsheet;
  }

  private finishSetup(): void {
    this.router.navigate([ROUTE.dashboard], { replaceUrl: true, queryParamsHandling: 'preserve' });
  }

  private async createSheet(
    title: string,
    columnCount: number,
    spreadsheet: gapi.client.sheets.Spreadsheet
  ): Promise<number> {
    const sheet = spreadsheet.sheets?.find((s) => s.properties?.title === title);
    let sheetId: number | undefined = sheet?.properties?.sheetId;

    if (!sheet) {
      log(`${title} sheet creation`);

      sheetId = await this.spreadsheetService
        .addSheet(title, spreadsheet.spreadsheetId!, columnCount)
        .then((sheet) => sheet?.sheetId);

      log(`${title} sheet created sheetId: ${sheetId}`);
    } else {
      log(`${title} sheet exists: ${sheetId}`);
    }

    if (sheetId === undefined) {
      throw `error getting ${title} sheet`;
    }

    return sheetId;
  }
}
