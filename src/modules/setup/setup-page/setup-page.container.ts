import { AsyncPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

import { Store } from '@ngrx/store';
import { EMPTY, Observable, catchError, concatMap, finalize, from, map, of, switchMap, take, tap, toArray } from 'rxjs';

import { AppActions, categoriesSheetIdSelector, currentSheetSelector, spreadsheetIdSelector } from 'src/@state';
import { CATEGORIES_SHEET_ID, CATEGORIES_SHEET_TITLE, DATA_SHEETS, DATA_SHEET_TITLE_PREFIX, ROUTE, SPREADSHEET_ID } from 'src/constants';
import { AbstractSecurityService, PickerService, SpreadsheetService } from 'src/services';
import { EXPENSE_COLUMN_COUNT } from 'src/services/spreadsheet/expense-row';
import { Category, Sheet, Userinfo } from 'src/shared/models';

type Stage = 'choose' | 'tabs' | 'categories' | 'save' | 'ready';

@Component({
  selector: 'setup-page',
  templateUrl: './setup-page.container.html',
  styleUrl: './setup-page.container.scss',
  imports: [FormsModule, AsyncPipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
})
export class SettingsPageContainer {
  readonly spreadsheetIdField = SPREADSHEET_ID;
  readonly sheetField = DATA_SHEETS;
  readonly categoriesSheetIdField = CATEGORIES_SHEET_ID;
  readonly spreadsheetId: Observable<string | undefined> = this.store.select(spreadsheetIdSelector);
  readonly sheet$: Observable<Sheet | undefined> = this.store.select(currentSheetSelector);
  readonly categoriesSheetId: Observable<number | undefined> = this.store.select(categoriesSheetIdSelector);
  protected readonly loading = signal<boolean>(false);
  protected readonly stage = signal<Stage>('choose');
  protected readonly selectedSpreadsheetId = signal<string | undefined>(undefined);
  protected readonly error = signal('');
  protected readonly sheetDone = signal<boolean>(false);
  protected readonly categoriesSheetDone = signal<boolean>(false);
  protected readonly draft = signal<string[] | undefined>(undefined);
  protected readonly acceptedCategories = signal<Category[] | undefined>(undefined);
  protected readonly validationError = signal('');
  protected readonly retryAllowed = signal(false);

  constructor(
    private readonly router: Router,
    private readonly security: AbstractSecurityService,
    private readonly spreadsheetService: SpreadsheetService,
    private readonly picker: PickerService,
    private readonly store: Store,
  ) {
    this.store.dispatch(AppActions.setTitle({ title: 'Settings', icon: 'settings' }));
  }

  chooseExisting(): void {
    if (this.loading()) return;
    this.loading.set(true);
    let picked = false;
    this.picker
      .pickSpreadsheet()
      .pipe(
        switchMap(id => {
          if (!id) return EMPTY;
          picked = true;
          return this.setupSpreadsheet(id);
        }),
        catchError(error => {
          log(error);
          if (picked) this.setSetupError();
          else {
            this.error.set('Could not open the spreadsheet picker. Try Choose existing again.');
            this.retryAllowed.set(false);
          }
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  createNewSpreadsheet(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.retryAllowed.set(false);
    let createdId: string | undefined;
    this.spreadsheetService
      .createSpreadsheet()
      .pipe(
        switchMap(spreadsheet => {
          createdId = spreadsheet.spreadsheetId;
          if (!createdId?.trim()) throw new Error('No spreadsheet ID returned');
          return this.setupSpreadsheet(createdId);
        }),
        catchError(error => {
          log(error);
          if (createdId?.trim()) this.setSetupError();
          else this.error.set('A spreadsheet might have been created. Use Choose existing to find it.');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  retrySetup(): void {
    const id = this.selectedSpreadsheetId();
    if (this.loading() || !id || !this.retryAllowed()) return;
    this.loading.set(true);
    this.error.set('');
    this.retryAllowed.set(false);
    const request =
      this.stage() === 'tabs' ? this.setupSpreadsheet(id) : this.stage() === 'save' ? this.saveAcceptedCategories() : this.loadCategories();
    request
      .pipe(
        catchError(error => {
          log(error);
          this.setSetupError();
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  private setupSpreadsheet(id: string): Observable<unknown> {
    if (id !== this.selectedSpreadsheetId()) {
      this.selectedSpreadsheetId.set(id);
      this.sheetDone.set(false);
      this.categoriesSheetDone.set(false);
      this.draft.set(undefined);
      this.acceptedCategories.set(undefined);
      this.validationError.set('');
    }
    this.stage.set('tabs');
    this.error.set('');
    this.retryAllowed.set(false);
    this.spreadsheetService.setSpreadsheetId(id);
    this.store.dispatch(AppActions.spreadsheetId({ spreadsheetId: id }));
    return this.spreadsheetService.getSpreadsheet(id).pipe(
      tap(spreadsheet => this.storeDataSheets(spreadsheet)),
      switchMap(spreadsheet =>
        this.security.user$.pipe(
          take(1),
          switchMap(user => {
            if (!user) throw new Error('Could not get the user');
            return this.createCategoriesSheet(spreadsheet).pipe(switchMap(() => this.createDataSheet(spreadsheet, user)));
          }),
        ),
      ),
      switchMap(() => (this.acceptedCategories() ? this.saveAcceptedCategories() : this.loadCategories())),
    );
  }

  private loadCategories(): Observable<Category[]> {
    this.stage.set('categories');
    return this.spreadsheetService.getAllCategories().pipe(
      tap(categories => {
        if (categories.length) this.completeCategories(categories);
        else if (!this.draft()) {
          this.draft.set([
            'Groceries',
            'Eating out',
            'Transport',
            'Home',
            'Health',
            'Clothes',
            'Entertainment',
            'Subscriptions',
            'Gifts',
            'Other',
          ]);
        }
      }),
    );
  }

  editCategory(index: number, name: string): void {
    if (!this.canEditCategories()) return;
    this.draft.update(names => names?.map((value, i) => (i === index ? name : value)));
    this.validationError.set('');
  }

  addCategory(): void {
    if (!this.canEditCategories()) return;
    this.draft.update(names => [...names!, '']);
    this.validationError.set('');
  }

  removeCategory(index: number): void {
    if (!this.canEditCategories()) return;
    this.draft.update(names => names?.filter((_, i) => i !== index));
    this.validationError.set('');
  }

  protected canEditCategories(): boolean {
    return !this.loading() && this.stage() === 'categories' && this.draft() !== undefined && !this.acceptedCategories() && !this.error();
  }

  saveCategories(): void {
    if (!this.canEditCategories()) return;
    const names = this.draft()!.map(name => name.trim());
    this.draft.set(names);
    if (!names.length) {
      this.validationError.set('Use Skip to continue without categories.');
      return;
    }
    if (names.some(name => !name)) {
      this.validationError.set('Enter a name for each category.');
      return;
    }
    if (new Set(names).size !== names.length) {
      this.validationError.set('Use a different name for each category.');
      return;
    }
    this.validationError.set('');
    this.acceptedCategories.set(names.map((name, id) => ({ name, id })));
    this.loading.set(true);
    this.error.set('');
    this.retryAllowed.set(false);
    this.saveAcceptedCategories()
      .pipe(
        catchError(error => {
          log(error);
          this.setSetupError();
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  private saveAcceptedCategories(): Observable<Category[]> {
    this.stage.set('save');
    return this.spreadsheetService.getAllCategories().pipe(
      switchMap(saved => {
        const savedNames = new Set(saved.map(category => category.name));
        return from(this.acceptedCategories()!.filter(category => !savedNames.has(category.name))).pipe(
          concatMap(category => this.spreadsheetService.addCategory(category)),
          toArray(),
        );
      }),
      switchMap(() => this.spreadsheetService.getAllCategories()),
      tap(categories => this.completeCategories(categories)),
    );
  }

  skipCategories(): void {
    if (!this.canEditCategories()) return;
    this.completeCategories([]);
  }

  private completeCategories(categories: Category[]): void {
    this.store.dispatch(AppActions.storeCategories({ categories }));
    this.stage.set('ready');
  }

  private setSetupError(): void {
    this.retryAllowed.set(true);
    this.error.set(
      this.stage() === 'tabs'
        ? 'Could not set up the spreadsheet tabs. Try again.'
        : this.stage() === 'save'
          ? 'Could not save all categories. Retry to check saved rows and finish saving.'
          : 'Could not read categories. Try again.',
    );
  }

  private storeDataSheets(spreadsheet: gapi.client.sheets.Spreadsheet): void {
    const dataSheets = spreadsheet.sheets
      ?.filter(sheet => !sheet.properties?.hidden)
      .filter(sheet => sheet.properties?.title?.includes(DATA_SHEET_TITLE_PREFIX))
      .map(sheet => ({ id: sheet.properties!.sheetId!, title: sheet.properties!.title! }));
    log('filtered dataSheets', dataSheets);
    dataSheets?.forEach(dataSheet => this.store.dispatch(AppActions.upsertDataSheet({ dataSheet })));
  }

  private createDataSheet(spreadsheet: gapi.client.sheets.Spreadsheet, user: Userinfo) {
    return this.createSheet(DATA_SHEET_TITLE_PREFIX + user.name, EXPENSE_COLUMN_COUNT, spreadsheet).pipe(
      switchMap(dataSheet => {
        this.store.dispatch(AppActions.upsertDataSheet({ dataSheet }));
        this.store.dispatch(AppActions.setCurrentSheet({ sheet: dataSheet.title }));
        log('data sheet format adjust...');
        return this.spreadsheetService.setDataSheetFormats(dataSheet.id);
      }),
      tap(() => {
        log('data sheet format adjust finish');
        this.sheetDone.set(true);
      }),
    );
  }

  private createCategoriesSheet(spreadsheet: gapi.client.sheets.Spreadsheet) {
    return this.createSheet(CATEGORIES_SHEET_TITLE, 2, spreadsheet).pipe(
      switchMap(categoriesSheet => {
        this.store.dispatch(AppActions.categoriesSheetId({ categoriesSheetId: categoriesSheet.id }));
        log('categories sheet format adjust...');
        return this.spreadsheetService.setCategoriesSheetFormats(categoriesSheet.id);
      }),
      tap(() => {
        log('categories sheet format adjust finish');
        this.categoriesSheetDone.set(true);
      }),
    );
  }

  finishSetup(): void {
    if (this.loading() || this.stage() !== 'ready' || !this.sheetDone() || !this.categoriesSheetDone()) return;
    this.router.navigate([ROUTE.dashboard], {
      replaceUrl: true,
      queryParams: { state: null, code: null, scope: null },
      queryParamsHandling: 'merge',
    });
  }

  private createSheet(title: string, columnCount: number, spreadsheet: gapi.client.sheets.Spreadsheet): Observable<Sheet> {
    const sheet = spreadsheet.sheets?.find(s => s.properties?.title === title)?.properties;

    if (sheet) {
      log(`sheet exists [${sheet.title}]`);
      return of({ id: sheet.sheetId!, title: sheet.title! });
    }

    log(`sheet creation [${title}]...`);
    return this.spreadsheetService.addSheet(title, columnCount).pipe(
      tap(sheet => log(`sheet created [${sheet.title}]`)),
      map(sheet => ({ id: sheet.sheetId!, title: sheet.title! })),
    );
  }
}
