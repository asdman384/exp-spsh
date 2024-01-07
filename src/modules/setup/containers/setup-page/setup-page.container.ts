import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, first, firstValueFrom } from 'rxjs';

import { AppActions, categoriesSheetIdSelector, currentSheetSelector, spreadsheetIdSelector } from 'src/@state';
import {
  CATEGORIES_SHEET_ID,
  CATEGORIES_SHEET_TITLE,
  DATA_SHEETS,
  DATA_SHEET_TITLE_PREFIX,
  ROUTE,
  SPREADSHEET_ID
} from 'src/constants';
import { SecurityService, SpreadsheetService } from 'src/services';
import { Sheet } from 'src/shared/models';

type State = 'check document' | 'finish';

@Component({
  selector: 'setup-page',
  templateUrl: './setup-page.container.html',
  styleUrl: './setup-page.container.scss'
})
export class SettingsPageContainer {
  readonly spreadsheetIdField = SPREADSHEET_ID;
  readonly sheetField = DATA_SHEETS;
  readonly categoriesSheetIdField = CATEGORIES_SHEET_ID;
  readonly spreadsheetId: Observable<string | undefined> = this.store.select(spreadsheetIdSelector);
  readonly sheet$: Observable<Sheet | undefined> = this.store.select(currentSheetSelector);
  readonly categoriesSheetId: Observable<number | undefined> = this.store.select(categoriesSheetIdSelector);
  loading: boolean = false;
  state: State = 'check document';
  sheetDone: boolean = false;
  categoriesSheetDone: boolean = false;

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
    const spreadsheetId: string = this.extractSpreadsheetId(form.value[this.spreadsheetIdField]);
    const user = await firstValueFrom(this.security.user$);
    if (!user) {
      throw new Error('error getting user');
    }

    this.loading = true;

    log('load SpreadSheet...');
    const spreadsheet = await this.loadSpreadSheet(spreadsheetId);
    log('load SpreadSheet done');

    spreadsheet.sheets
      ?.filter((sheet) => !sheet.properties?.index)
      .filter((sheet) => sheet.properties?.title?.includes(DATA_SHEET_TITLE_PREFIX))
      .map((sheet) => ({ id: sheet.properties!.sheetId!, title: sheet.properties!.title! }))
      .forEach((dataSheet) => this.store.dispatch(AppActions.upsertDataSheet({ dataSheet })));

    const dataSheet = await this.createSheet(DATA_SHEET_TITLE_PREFIX + user.name, 4, spreadsheet);
    this.store.dispatch(AppActions.upsertDataSheet({ dataSheet }));
    this.store.dispatch(AppActions.setCurrentSheet({ sheet: dataSheet.title }));
    const categoriesSheet = await this.createSheet(CATEGORIES_SHEET_TITLE, 2, spreadsheet);
    this.store.dispatch(AppActions.categoriesSheetId({ categoriesSheetId: categoriesSheet.id }));

    log('data sheet format adjust...');
    await this.spreadsheetService.setDataSheetFormats(spreadsheet.spreadsheetId!, dataSheet.id);
    this.sheetDone = true;
    log('data sheet format adjust finish');

    log('categories sheet format adjust...');
    await this.spreadsheetService.setCategoriesSheetFormats(spreadsheet.spreadsheetId!, categoriesSheet.id);
    this.categoriesSheetDone = true;
    log('categories sheet format adjust finish');

    this.loading = false;
    this.state = 'finish';
  }

  private extractSpreadsheetId(resourceUrl: string): string {
    let spreadsheetId = new RegExp('/spreadsheets/d/([a-zA-Z0-9-_]+)').exec(resourceUrl);
    if (spreadsheetId && spreadsheetId[1]) {
      return spreadsheetId[1];
    }

    spreadsheetId = new RegExp('([a-zA-Z0-9-_]+)').exec(resourceUrl);
    if (spreadsheetId && spreadsheetId[1]) {
      return spreadsheetId[1];
    }
    log('cannot read spreadsheet id.', spreadsheetId);
    throw new Error('cannot read spreadsheet id.');
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
  ): Promise<Sheet> {
    let sheet = spreadsheet.sheets?.find((s) => s.properties?.title === title)?.properties;

    if (!sheet) {
      log(`sheet creation [${title}]...`);
      sheet = await this.spreadsheetService.addSheet(title, spreadsheet.spreadsheetId!, columnCount);
      log(`sheet created [${sheet.title}]`);
    } else {
      log(`sheet exists [${sheet.title}]`);
    }

    if (sheet === undefined) {
      throw `error getting ${title} sheet`;
    }

    return { id: sheet.sheetId!, title: sheet.title! };
  }
}
