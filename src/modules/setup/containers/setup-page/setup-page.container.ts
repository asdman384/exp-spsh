import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';

import { Store } from '@ngrx/store';
import { Observable, forkJoin, map, of, switchMap, tap, withLatestFrom } from 'rxjs';

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
import { Sheet, Userinfo } from 'src/shared/models';

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

  checkSetup(form: NgForm, state: State): void {
    if (state === 'finish') {
      this.finishSetup();
      return;
    }

    if (!form.valid) return;
    const spreadsheetId: string = this.extractSpreadsheetId(form.value[this.spreadsheetIdField]);

    this.loading = true;
    log('load SpreadSheet...');

    this.loadSpreadSheet(spreadsheetId)
      .pipe(
        tap((spreadsheet) => log('load SpreadSheet done, sheets: ', spreadsheet.sheets)),
        tap((spreadsheet) => this.storeDataSheets(spreadsheet)),
        withLatestFrom(this.security.user$),
        tap(([spreadsheet, user]) => {
          if (!user) throw new Error('error getting user');
        }),
        switchMap(([spreadsheet, user]) =>
          forkJoin([this.createDataSheet(spreadsheet, user!), this.createCategoriesSheet(spreadsheet)])
        )
      )
      .subscribe(() => {
        this.loading = false;
        this.state = 'finish';
        this.store.dispatch(AppActions.storeCategories({ categories: [] }));
      });
  }

  private storeDataSheets(spreadsheet: gapi.client.sheets.Spreadsheet): void {
    const dataSheets = spreadsheet.sheets
      ?.filter((sheet) => !sheet.properties?.hidden)
      .filter((sheet) => sheet.properties?.title?.includes(DATA_SHEET_TITLE_PREFIX))
      .map((sheet) => ({ id: sheet.properties!.sheetId!, title: sheet.properties!.title! }));
    log('filtered dataSheets', dataSheets);
    dataSheets?.forEach((dataSheet) => this.store.dispatch(AppActions.upsertDataSheet({ dataSheet })));
  }

  private createDataSheet(spreadsheet: gapi.client.sheets.Spreadsheet, user: Userinfo): Observable<any> {
    return this.createSheet(DATA_SHEET_TITLE_PREFIX + user.name, 4, spreadsheet).pipe(
      switchMap((dataSheet) => {
        this.store.dispatch(AppActions.upsertDataSheet({ dataSheet }));
        this.store.dispatch(AppActions.setCurrentSheet({ sheet: dataSheet.title }));
        log('data sheet format adjust...');
        return this.spreadsheetService.setDataSheetFormats(spreadsheet.spreadsheetId!, dataSheet.id);
      }),
      tap(() => {
        log('data sheet format adjust finish');
        this.sheetDone = true;
      })
    );
  }

  private createCategoriesSheet(spreadsheet: gapi.client.sheets.Spreadsheet): Observable<any> {
    return this.createSheet(CATEGORIES_SHEET_TITLE, 2, spreadsheet).pipe(
      switchMap((categoriesSheet) => {
        this.store.dispatch(AppActions.categoriesSheetId({ categoriesSheetId: categoriesSheet.id }));
        log('categories sheet format adjust...');
        return this.spreadsheetService.setCategoriesSheetFormats(spreadsheet.spreadsheetId!, categoriesSheet.id);
      }),
      tap(() => {
        log('categories sheet format adjust finish');
        this.categoriesSheetDone = true;
      })
    );
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

  private loadSpreadSheet(spreadsheetId: string): Observable<gapi.client.sheets.Spreadsheet> {
    return this.spreadsheetService.getSpreadsheet(spreadsheetId).pipe(
      tap(({ spreadsheetId }) => {
        if (spreadsheetId === undefined) {
          throw Error('error getting spreadsheet');
        }
        log('loaded spreadsheet ' + spreadsheetId);
        this.store.dispatch(AppActions.spreadsheetId({ spreadsheetId }));
      })
    );
  }

  private finishSetup(): void {
    this.router.navigate([ROUTE.dashboard], { replaceUrl: true, queryParamsHandling: 'preserve' });
  }

  private createSheet(
    title: string,
    columnCount: number,
    spreadsheet: gapi.client.sheets.Spreadsheet
  ): Observable<Sheet> {
    let sheet = spreadsheet.sheets?.find((s) => s.properties?.title === title)?.properties;

    if (sheet) {
      log(`sheet exists [${sheet.title}]`);
      return of({ id: sheet.sheetId!, title: sheet.title! });
    }

    log(`sheet creation [${title}]...`);
    return this.spreadsheetService.addSheet(title, spreadsheet.spreadsheetId!, columnCount).pipe(
      tap((sheet) => log(`sheet created [${sheet.title}]`)),
      map((sheet) => ({ id: sheet.sheetId!, title: sheet.title! }))
    );
  }
}
