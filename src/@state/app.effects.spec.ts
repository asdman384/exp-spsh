import { TestBed } from '@angular/core/testing';

import { MatSnackBar } from '@angular/material/snack-bar';
import { Action, Store } from '@ngrx/store';
import { provideMockActions } from '@ngrx/effects/testing';
import { Subject, of } from 'rxjs';

import { NetworkStatusService, SpreadsheetService } from 'src/services';
import { Category } from 'src/shared/models';
import { AppActions } from './app.actions';
import { AppEffects } from './app.effects';
import { categoriesSelector, categoriesSheetIdSelector } from './app.selectors';
import { FAILURE_MESSAGES } from './report-failure';

// [AC16] showFailureToast$ — established here as the first effects-test precedent in this repo.
//
// `AppEffects`'s field initializers call `this.store.select(...)` synchronously during
// construction (see Risks in docs/specs/effect-error-surfacing.md), so the `Store` stub's
// `select` must return an Observable, not a bare mock function, or `TestBed.inject(AppEffects)`
// throws before any test body runs.
//
// Other effect fields (`saveSpreadsheetId$`, `loadCategories$`, ...) reference the bare global
// `tap(log)` at pipe-build time, i.e. while `createEffect`'s factory function runs during field
// initialization — before any subscription. Referencing that undeclared identifier throws a
// `ReferenceError` immediately, independent of whether the effect is ever triggered. In the real
// app `log` is installed by a dynamic `import('src/logger')` in `main.ts` before bootstrap; tests
// don't go through `main.ts`, so this spec installs an equivalent global stub purely so
// `AppEffects` can be constructed. It is never asserted on, and no DOM overlay is touched.
describe('[AC16] AppEffects.showFailureToast$', () => {
  let actions$: Subject<Action>;
  let snackBarOpen: ReturnType<typeof vi.fn>;
  let effects: AppEffects;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op stub, never asserted on (see comment above)
    (globalThis as unknown as { log: (...args: unknown[]) => void }).log = () => {};
    actions$ = new Subject<Action>();
    snackBarOpen = vi.fn();

    const storeStub: Pick<Store, 'select' | 'dispatch'> = {
      select: vi.fn().mockReturnValue(of(undefined)),
      dispatch: vi.fn()
    };
    const networkStub: Pick<NetworkStatusService, 'online$'> = { online$: of(true) };
    const spreadsheetStub = {} as SpreadsheetService;
    const snackBarStub: Pick<MatSnackBar, 'open'> = { open: snackBarOpen as unknown as MatSnackBar['open'] };

    TestBed.configureTestingModule({
      providers: [
        AppEffects,
        provideMockActions(() => actions$),
        { provide: Store, useValue: storeStub },
        { provide: NetworkStatusService, useValue: networkStub },
        { provide: SpreadsheetService, useValue: spreadsheetStub },
        { provide: MatSnackBar, useValue: snackBarStub }
      ]
    });

    effects = TestBed.inject(AppEffects);
  });

  afterEach(() => {
    delete (globalThis as unknown as { log?: unknown }).log;
  });

  it('should_open_snackbar_exactly_once_with_message_dismiss_and_no_duration_assertive_config', () => {
    effects.showFailureToast$.subscribe();

    actions$.next(AppActions.operationFailed({ source: 'addExpense$', message: FAILURE_MESSAGES.addExpense$ }));

    expect(snackBarOpen).toHaveBeenCalledTimes(1);
    const [message, action, config] = snackBarOpen.mock.calls[0] as [string, string, Record<string, unknown>];

    expect(message).toBe(FAILURE_MESSAGES.addExpense$);
    expect(action).toBe('Dismiss');
    expect(config).not.toHaveProperty('duration');
    expect(config['politeness']).toBe('assertive');
  });

  it('should_open_snackbar_twice_for_two_consecutive_operationFailed_actions_with_identical_payloads', () => {
    effects.showFailureToast$.subscribe();

    const action = AppActions.operationFailed({ source: 'loadExpenses$', message: FAILURE_MESSAGES.loadExpenses$ });
    actions$.next(action);
    actions$.next(action);

    expect(snackBarOpen).toHaveBeenCalledTimes(2);
    expect(snackBarOpen).toHaveBeenNthCalledWith(
      1,
      FAILURE_MESSAGES.loadExpenses$,
      'Dismiss',
      expect.objectContaining({ politeness: 'assertive' })
    );
    expect(snackBarOpen).toHaveBeenNthCalledWith(
      2,
      FAILURE_MESSAGES.loadExpenses$,
      'Dismiss',
      expect.objectContaining({ politeness: 'assertive' })
    );
  });
});

// Sheet-mapping boundary coverage (docs/backend-less-assessment.md item #10): deleteCategory$ uses
// the array index found via `categories.findIndex` directly as the sheet row index -- the pattern
// the assessment flags as "only valid immediately after a fresh load". These tests pin the index
// arithmetic for a non-trivial (middle) position and the not-found guard.
describe('AppEffects.deleteCategory$ — sheet-row index arithmetic', () => {
  let actions$: Subject<Action>;
  let dispatch: ReturnType<typeof vi.fn>;
  let deleteSheetRow: ReturnType<typeof vi.fn>;
  let effects: AppEffects;

  const sheetId = 7;

  function configure(categories: Array<Category>): void {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op stub, see [AC16] comment above
    (globalThis as unknown as { log: (...args: unknown[]) => void }).log = () => {};
    actions$ = new Subject<Action>();
    dispatch = vi.fn();
    deleteSheetRow = vi.fn().mockReturnValue(of({}));

    const select = vi.fn((selector: unknown) => {
      if (selector === categoriesSheetIdSelector) return of(sheetId);
      if (selector === categoriesSelector) return of(categories);
      return of(undefined);
    });

    const storeStub: Pick<Store, 'select' | 'dispatch'> = {
      select: select as unknown as Store['select'],
      dispatch: dispatch as unknown as Store['dispatch']
    };
    const networkStub: Pick<NetworkStatusService, 'online$'> = { online$: of(true) };
    const spreadsheetStub = { deleteSheetRow } as unknown as SpreadsheetService;
    const snackBarStub: Pick<MatSnackBar, 'open'> = { open: vi.fn() as unknown as MatSnackBar['open'] };

    TestBed.configureTestingModule({
      providers: [
        AppEffects,
        provideMockActions(() => actions$),
        { provide: Store, useValue: storeStub },
        { provide: NetworkStatusService, useValue: networkStub },
        { provide: SpreadsheetService, useValue: spreadsheetStub },
        { provide: MatSnackBar, useValue: snackBarStub }
      ]
    });

    effects = TestBed.inject(AppEffects);
  }

  afterEach(() => {
    delete (globalThis as unknown as { log?: unknown }).log;
  });

  it('should_pass_the_array_index_of_the_deleted_category_to_deleteSheetRow', () => {
    const categories: Array<Category> = [
      { name: 'Food', id: 0 },
      { name: 'Transport', id: 1 },
      { name: 'Bills', id: 2 },
      { name: 'Other', id: 3 }
    ];
    configure(categories);

    const emitted: Array<Action> = [];
    effects.deleteCategory$.subscribe((action) => emitted.push(action));

    actions$.next(AppActions.deleteCategory({ category: categories[2] })); // middle item, index 2

    expect(deleteSheetRow).toHaveBeenCalledWith(sheetId, 2);
    expect(emitted).toContainEqual(
      AppActions.storeCategories({ categories: [categories[0], categories[1], categories[3]] })
    );
  });

  it('should_not_delete_and_should_report_failure_when_category_is_not_found', () => {
    const categories: Array<Category> = [
      { name: 'Food', id: 0 },
      { name: 'Transport', id: 1 }
    ];
    configure(categories);

    effects.deleteCategory$.subscribe();

    actions$.next(AppActions.deleteCategory({ category: { name: 'Nonexistent', id: 99 } }));

    expect(deleteSheetRow).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      AppActions.operationFailed({ source: 'deleteCategory$', message: FAILURE_MESSAGES.deleteCategory$ })
    );
  });
});
