import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store, StoreModule } from '@ngrx/store';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AppActions, categoriesSelector, reducers } from 'src/@state';
import { ROUTE } from 'src/constants';
import { AbstractSecurityService, PickerService, SpreadsheetService } from 'src/services';
import { EXPENSE_COLUMN_COUNT } from 'src/services/spreadsheet/expense-row';
import { Category } from 'src/shared/models';
import { SettingsPageContainer } from './setup-page.container';

describe('SettingsPageContainer spreadsheet setup', () => {
  const starters = [
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
  ];
  const metadata: gapi.client.sheets.Spreadsheet = {
    spreadsheetId: 'file-1',
    sheets: [{ properties: { sheetId: 11, title: 'categories' } }, { properties: { sheetId: 12, title: 'data_Alex' } }],
  };
  let fixture: ComponentFixture<SettingsPageContainer>;
  let component: SettingsPageContainer;
  let store: Store;
  let saved: Category[];
  const router = { navigate: vi.fn() };
  const picker = { pickSpreadsheet: vi.fn<() => Observable<string | undefined>>() };
  const service = {
    createSpreadsheet: vi.fn<() => Observable<gapi.client.sheets.Spreadsheet>>(),
    setSpreadsheetId: vi.fn(),
    getSpreadsheet: vi.fn<(id: string) => Observable<gapi.client.sheets.Spreadsheet>>(),
    addSheet: vi.fn<(title: string, count: number) => Observable<gapi.client.sheets.SheetProperties>>(),
    setCategoriesSheetFormats: vi.fn<(id: number) => Observable<gapi.client.sheets.BatchUpdateSpreadsheetResponse>>(),
    setDataSheetFormats: vi.fn<(id: number) => Observable<gapi.client.sheets.BatchUpdateSpreadsheetResponse>>(),
    getAllCategories: vi.fn<() => Observable<Category[]>>(),
    addCategory: vi.fn<(category: Category) => Observable<gapi.client.sheets.AppendValuesResponse>>(),
    updateCategories: vi.fn(),
    deleteSheetRow: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubGlobal('log', vi.fn());
    saved = [];
    picker.pickSpreadsheet.mockReturnValue(of('file-1'));
    service.createSpreadsheet.mockReturnValue(of({ spreadsheetId: 'file-1' }));
    service.getSpreadsheet.mockReturnValue(of(metadata));
    service.addSheet.mockImplementation(title => of({ title, sheetId: title === 'categories' ? 11 : 12 }));
    service.setCategoriesSheetFormats.mockReturnValue(of({}));
    service.setDataSheetFormats.mockReturnValue(of({}));
    service.getAllCategories.mockImplementation(() => of(saved.map(category => ({ ...category }))));
    service.addCategory.mockImplementation(category => {
      saved.push({ ...category });
      return of({});
    });
    await TestBed.configureTestingModule({
      imports: [SettingsPageContainer, StoreModule.forRoot(reducers)],
      providers: [
        { provide: Router, useValue: router },
        { provide: AbstractSecurityService, useValue: { user$: of({ name: 'Alex' }) } },
        { provide: SpreadsheetService, useValue: service },
        { provide: PickerService, useValue: picker },
      ],
    }).compileComponents();
    store = TestBed.inject(Store);
    store.dispatch(AppActions.storeCategories({ categories: [] }));
    fixture = TestBed.createComponent(SettingsPageContainer);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  function button(text: string): HTMLButtonElement {
    return [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)].find(
      b => b.textContent?.trim() === text,
    )!;
  }

  async function names(): Promise<string[]> {
    fixture.detectChanges();
    await fixture.whenStable();
    return [...(fixture.nativeElement.querySelectorAll('input[name^="category-"]') as NodeListOf<HTMLInputElement>)].map(
      input => input.value,
    );
  }

  function text(): string {
    fixture.detectChanges();
    return fixture.nativeElement.textContent;
  }

  function choose(): void {
    component.chooseExisting();
    fixture.detectChanges();
  }

  function shortDraft(): void {
    choose();
    for (let i = 9; i >= 2; i--) component.removeCategory(i);
  }

  it('shows both file choices together and guards Finish before setup', async () => {
    expect(button('Create a new spreadsheet for me').parentElement).toBe(button('Choose existing').parentElement);
    expect(button('Finish').disabled).toBe(true);
    component.finishSetup();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('creates a file without Picker and retains its ID before metadata completes', async () => {
    const request = new Subject<gapi.client.sheets.Spreadsheet>();
    service.getSpreadsheet.mockReturnValue(request);
    component.createNewSpreadsheet();
    expect(picker.pickSpreadsheet).not.toHaveBeenCalled();
    expect(service.setSpreadsheetId).toHaveBeenCalledWith('file-1');
    expect(service.getSpreadsheet).toHaveBeenCalledWith('file-1');
    fixture.detectChanges();
    expect(button('Finish').disabled).toBe(true);
    request.next(metadata);
    request.complete();
    expect(await names()).toEqual(starters);
  });

  it('reuses exact matching tabs and formats categories before data', async () => {
    const categoryFormat = new Subject<gapi.client.sheets.BatchUpdateSpreadsheetResponse>();
    service.setCategoriesSheetFormats.mockReturnValue(categoryFormat);
    choose();
    expect(service.addSheet).not.toHaveBeenCalled();
    expect(service.setDataSheetFormats).not.toHaveBeenCalled();
    expect(text()).not.toContain('Categories tab is ready.');
    categoryFormat.next({});
    categoryFormat.complete();
    expect(service.setDataSheetFormats).toHaveBeenCalledWith(12);
    expect(text()).toContain('Categories tab is ready.');
    expect(text()).toContain('Data tab is ready.');
    expect(service.updateCategories).not.toHaveBeenCalled();
    expect(service.deleteSheetRow).not.toHaveBeenCalled();
  });

  it('creates missing tabs with the schema column counts, retaining other tabs', async () => {
    service.getSpreadsheet.mockReturnValue(of({ spreadsheetId: 'file-1', sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }] }));
    choose();
    expect(service.addSheet.mock.calls).toEqual([
      ['categories', 2],
      ['data_Alex', EXPENSE_COLUMN_COUNT],
    ]);
    expect(service.deleteSheetRow).not.toHaveBeenCalled();
  });

  it('retries tab failure with fresh metadata and the retained created file', async () => {
    service.setDataSheetFormats.mockReturnValueOnce(throwError(() => new Error('format')));
    component.createNewSpreadsheet();
    expect(text()).toContain('Could not set up the spreadsheet tabs');
    expect(button('Finish').disabled).toBe(true);
    component.retrySetup();
    expect(service.createSpreadsheet).toHaveBeenCalledOnce();
    expect(service.getSpreadsheet.mock.calls).toEqual([['file-1'], ['file-1']]);
    expect(await names()).toEqual(starters);
  });

  it.each([undefined, ''])('does not retry creation when the response has unusable ID %s', id => {
    service.createSpreadsheet.mockReturnValue(of({ spreadsheetId: id }));
    component.createNewSpreadsheet();
    expect(text()).toContain('A spreadsheet might have been created. Use Choose existing');
    component.retrySetup();
    expect(service.createSpreadsheet).toHaveBeenCalledOnce();
    expect(service.getSpreadsheet).not.toHaveBeenCalled();
    expect(button('Choose existing').disabled).toBe(false);
  });

  it('shows unknown creation failure and never sends an automatic second POST', async () => {
    service.createSpreadsheet.mockReturnValue(throwError(() => new Error('lost response')));
    component.createNewSpreadsheet();
    component.retrySetup();
    expect(service.createSpreadsheet).toHaveBeenCalledOnce();
    expect(text()).toContain('A spreadsheet might have been created');
    expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeNull();
  });

  it('blocks concurrent create, choose, retry, and Finish handlers', async () => {
    const request = new Subject<gapi.client.sheets.Spreadsheet>();
    service.createSpreadsheet.mockReturnValue(request);
    component.createNewSpreadsheet();
    component.createNewSpreadsheet();
    component.chooseExisting();
    component.retrySetup();
    component.finishSetup();
    fixture.detectChanges();
    expect(service.createSpreadsheet).toHaveBeenCalledOnce();
    expect(picker.pickSpreadsheet).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(button('Choose existing').disabled).toBe(true);
    expect(button('Create a new spreadsheet for me').disabled).toBe(true);
    request.complete();
    fixture.detectChanges();
    expect(button('Choose existing').disabled).toBe(false);
  });

  it('preserves the selected file and edited draft when Picker is cancelled', async () => {
    choose();
    component.editCategory(0, 'Custom');
    picker.pickSpreadsheet.mockReturnValue(of(undefined));
    component.chooseExisting();
    expect((await names())[0]).toBe('Custom');
    expect(service.getSpreadsheet).toHaveBeenCalledOnce();
    expect(service.setSpreadsheetId).toHaveBeenCalledExactlyOnceWith('file-1');
    expect(text()).toContain('Data tab is ready.');
  });

  it('preserves ready completion when Picker is cancelled', async () => {
    choose();
    component.skipCategories();
    picker.pickSpreadsheet.mockReturnValue(of(undefined));
    component.chooseExisting();
    fixture.detectChanges();
    expect(button('Finish').disabled).toBe(false);
  });

  it('shows Picker failure without treating it as an empty category sheet', async () => {
    picker.pickSpreadsheet.mockReturnValue(throwError(() => new Error('picker')));
    choose();
    expect(text()).toContain('Could not open the spreadsheet picker');
    expect(await names()).toEqual([]);
    expect(button('Choose existing').disabled).toBe(false);
  });

  it('loads existing categories into the dashboard selector without any writes', async () => {
    saved = [{ name: 'Existing', id: 7 }];
    let categories: Category[] = [];
    const subscription = store.select(categoriesSelector).subscribe(value => (categories = value));
    choose();
    expect(categories).toEqual(saved);
    expect(await names()).toEqual([]);
    expect(service.addCategory).not.toHaveBeenCalled();
    expect(service.updateCategories).not.toHaveBeenCalled();
    expect(button('Finish').disabled).toBe(false);
    subscription.unsubscribe();
  });

  it('offers the exact starter list for an empty sheet and keeps edits local', async () => {
    choose();
    expect(await names()).toEqual(starters);
    component.editCategory(0, 'Food');
    component.removeCategory(1);
    component.addCategory();
    component.editCategory(9, 'Travel');
    expect(await names()).toEqual(['Food', ...starters.slice(2), 'Travel']);
    expect(service.addCategory).not.toHaveBeenCalled();
    expect(button('Finish').disabled).toBe(true);
  });

  it('does not expose starters after a failed read and retries the read only', async () => {
    service.getAllCategories.mockReturnValueOnce(throwError(() => new Error('read')));
    choose();
    expect(await names()).toEqual([]);
    expect(text()).toContain('Could not read categories');
    component.finishSetup();
    expect(router.navigate).not.toHaveBeenCalled();
    component.retrySetup();
    expect(await names()).toEqual(starters);
    expect(service.getSpreadsheet).toHaveBeenCalledOnce();
  });

  it('retains a draft when the same file is selected and a read fails', async () => {
    choose();
    component.editCategory(0, 'Local');
    service.getAllCategories.mockReturnValueOnce(throwError(() => new Error('read')));
    choose();
    component.skipCategories();
    fixture.detectChanges();
    expect(button('Finish').disabled).toBe(true);
    component.retrySetup();
    expect((await names())[0]).toBe('Local');
  });

  it('resets draft state only for a confirmed different file', async () => {
    choose();
    component.editCategory(0, 'Local');
    picker.pickSpreadsheet.mockReturnValue(of('file-2'));
    choose();
    expect(await names()).toEqual(starters);
    expect(service.setSpreadsheetId).toHaveBeenLastCalledWith('file-2');
  });

  it.each([' ', '\t'])('rejects blank names after trimming %s', value => {
    choose();
    component.editCategory(0, value);
    component.saveCategories();
    expect(text()).toContain('Enter a name for each category.');
    expect(service.addCategory).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('input[name="category-0"]').getAttribute('aria-describedby')).toBe('category-validation');
  });

  it('rejects exact duplicates after trimming', async () => {
    choose();
    component.editCategory(0, ' Home ');
    component.saveCategories();
    expect(text()).toContain('Use a different name for each category.');
    expect(service.addCategory).not.toHaveBeenCalled();
  });

  it('trims names and keeps case-sensitive identity in the edited final order', async () => {
    shortDraft();
    component.editCategory(0, ' Food ');
    component.editCategory(1, 'food');
    component.addCategory();
    component.editCategory(2, ' Travel ');
    component.saveCategories();
    expect(saved).toEqual([
      { name: 'Food', id: 0 },
      { name: 'food', id: 1 },
      { name: 'Travel', id: 2 },
    ]);
  });

  it('directs an empty draft to Skip and never sends an empty update', async () => {
    choose();
    for (let i = 9; i >= 0; i--) component.removeCategory(i);
    component.saveCategories();
    expect(text()).toContain('Use Skip to continue without categories.');
    expect(button('Save categories').disabled).toBe(true);
    component.skipCategories();
    fixture.detectChanges();
    expect(button('Finish').disabled).toBe(false);
    expect(service.addCategory).not.toHaveBeenCalled();
    expect(service.updateCategories).not.toHaveBeenCalled();
  });

  it('Skip publishes empty categories without writes', async () => {
    store.dispatch(AppActions.storeCategories({ categories: [{ name: 'Old file', id: 0 }] }));
    choose();
    component.skipCategories();
    let categories: Category[] | undefined;
    const subscription = store.select(categoriesSelector).subscribe(value => (categories = value));
    expect(categories).toEqual([]);
    expect(service.addCategory).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('saves all ten starters once with positions zero through nine and publishes before navigation', async () => {
    choose();
    let categories: Category[] = [];
    const subscription = store.select(categoriesSelector).subscribe(value => (categories = value));
    component.saveCategories();
    expect(service.addCategory.mock.calls.map(([category]) => category)).toEqual(starters.map((name, id) => ({ name, id })));
    expect(categories).toEqual(saved);
    router.navigate.mockImplementation(() => {
      expect(categories).toEqual(starters.map((name, id) => ({ name, id })));
      return Promise.resolve(true);
    });
    component.finishSetup();
    expect(router.navigate).toHaveBeenCalledWith([ROUTE.dashboard], {
      replaceUrl: true,
      queryParams: { state: null, code: null, scope: null },
      queryParamsHandling: 'merge',
    });
    subscription.unsubscribe();
  });

  it('waits for each write and final read, blocking conflicting handlers', async () => {
    shortDraft();
    const first = new Subject<gapi.client.sheets.AppendValuesResponse>();
    const finalRead = new Subject<Category[]>();
    service.addCategory.mockReturnValueOnce(first);
    service.getAllCategories.mockReturnValueOnce(of([])).mockReturnValueOnce(finalRead);
    component.saveCategories();
    component.saveCategories();
    component.skipCategories();
    component.editCategory(0, 'Changed');
    component.addCategory();
    component.removeCategory(0);
    component.chooseExisting();
    component.createNewSpreadsheet();
    expect(service.addCategory).toHaveBeenCalledTimes(1);
    expect(picker.pickSpreadsheet).toHaveBeenCalledOnce();
    expect(service.createSpreadsheet).not.toHaveBeenCalled();
    expect(await names()).toEqual(starters.slice(0, 2));
    first.next({});
    first.complete();
    expect(service.addCategory).toHaveBeenCalledTimes(2);
    component.finishSetup();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(button('Finish').disabled).toBe(true);
    finalRead.next(starters.slice(0, 2).map((name, id) => ({ name, id })));
    finalRead.complete();
    fixture.detectChanges();
    expect(button('Finish').disabled).toBe(false);
  });

  it.each([false, true])('recovers partial saves (lost response: %s) without duplicate or overwritten rows', async lostResponse => {
    shortDraft();
    service.addCategory
      .mockImplementationOnce(category => {
        saved.push({ ...category });
        return of({});
      })
      .mockImplementationOnce(category => {
        if (lostResponse) saved.push({ ...category });
        return throwError(() => new Error('write'));
      });
    component.saveCategories();
    expect(text()).toContain('Could not save all categories');
    expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeNull();
    component.editCategory(0, 'Changed');
    component.skipCategories();
    expect(await names()).toEqual(starters.slice(0, 2));
    expect(fixture.nativeElement.querySelector('input[name="category-0"]').readOnly).toBe(true);
    expect(button('Skip')).toBeUndefined();
    component.retrySetup();
    expect(saved).toEqual(starters.slice(0, 2).map((name, id) => ({ name, id })));
    expect(service.addCategory).toHaveBeenCalledTimes(lostResponse ? 2 : 3);
    expect(service.updateCategories).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(button('Finish').disabled).toBe(false);
  });

  it('stops before writing if the pre-save or retry read fails', async () => {
    shortDraft();
    service.getAllCategories.mockReturnValueOnce(throwError(() => new Error('before save')));
    component.saveCategories();
    service.getAllCategories.mockReturnValueOnce(throwError(() => new Error('retry read')));
    component.retrySetup();
    expect(service.addCategory).not.toHaveBeenCalled();
    expect(text()).toContain('Could not save all categories');
    expect(button('Finish').disabled).toBe(true);
    component.retrySetup();
    expect(saved).toHaveLength(2);
  });

  it('recovers a failed final read without repeating completed writes', async () => {
    shortDraft();
    service.getAllCategories.mockReturnValueOnce(of([])).mockReturnValueOnce(throwError(() => new Error('final read')));
    component.saveCategories();
    expect(saved).toHaveLength(2);
    expect(text()).toContain('Could not save all categories');
    component.retrySetup();
    expect(service.addCategory).toHaveBeenCalledTimes(2);
    fixture.detectChanges();
    expect(button('Finish').disabled).toBe(false);
  });

  it('keeps saved differing rows and positions, appending missing snapshot names only', async () => {
    shortDraft();
    saved = [
      { name: 'Groceries', id: 18 },
      { name: 'Unrelated', id: 4 },
    ];
    component.saveCategories();
    expect(service.addCategory).toHaveBeenCalledExactlyOnceWith({ name: 'Eating out', id: 1 });
    expect(saved).toEqual([
      { name: 'Groceries', id: 18 },
      { name: 'Unrelated', id: 4 },
      { name: 'Eating out', id: 1 },
    ]);
    expect(service.updateCategories).not.toHaveBeenCalled();
    expect(service.deleteSheetRow).not.toHaveBeenCalled();
  });

  it('keeps all IDs in closed native Details and all controls explicitly non-submit', async () => {
    const details: HTMLDetailsElement = fixture.nativeElement.querySelector('details');
    expect(details.open).toBe(false);
    const inputs = [...details.querySelectorAll('input')];
    expect(inputs).toHaveLength(3);
    expect(inputs.every(input => input.readOnly)).toBe(true);
    details.querySelector('summary')!.click();
    expect(details.open).toBe(true);
    details.querySelector('summary')!.click();
    expect(details.open).toBe(false);
    expect([...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)].every(b => b.type === 'button')).toBe(
      true,
    );
  });

  it('keeps errors and progress outside Details and gives editor inputs visible labels', async () => {
    choose();
    expect(fixture.nativeElement.querySelectorAll('.category-row mat-label')).toHaveLength(10);
    const pending = new Subject<Category[]>();
    service.getAllCategories.mockReturnValueOnce(pending);
    component.saveCategories();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-progress-spinner').closest('details')).toBeNull();
    pending.error(new Error('read'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').closest('details')).toBeNull();
  });
});
