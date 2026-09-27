import { Injectable } from '@angular/core';

import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  EMPTY,
  catchError,
  exhaustMap,
  map,
  switchMap,
  tap,
  throwError,
  withLatestFrom
} from 'rxjs';

import { Store } from '@ngrx/store';
import { CATEGORIES, CATEGORIES_SHEET_ID, DATA_SHEETS, SPREADSHEET_ID } from 'src/constants';
import { LocalStorageService, SpreadsheetService } from 'src/services';
import { Memento } from 'src/shared/helpers';
import { Category } from 'src/shared/models';
import { AppActions } from './app.actions';
import { categoriesSelector, categoriesSheetIdSelector, sheetsSelector } from './app.selectors';
import { FAILURE_MESSAGES, reportFailure } from './report-failure';

@Injectable()
export class AppEffects {
  readonly saveSpreadsheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.spreadsheetId),
        tap(log),
        tap(({ spreadsheetId }) => spreadsheetId && LocalStorageService.put(SPREADSHEET_ID, spreadsheetId)),
        catchError((e) => {
          log(e);
          return EMPTY;
        })
      ),
    { dispatch: false }
  );

  readonly saveSheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.upsertDataSheet),
        tap(log),
        switchMap(() => this.store.select(sheetsSelector)),
        tap((sheets) => LocalStorageService.put(DATA_SHEETS, sheets)),
        catchError((e) => {
          log(e);
          return EMPTY;
        })
      ),
    { dispatch: false }
  );

  readonly saveCategoriesSheetId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.categoriesSheetId),
        tap(log),
        tap(
          ({ categoriesSheetId }) =>
            categoriesSheetId !== undefined && LocalStorageService.put(CATEGORIES_SHEET_ID, categoriesSheetId)
        ),
        catchError((e) => {
          log(e);
          return EMPTY;
        })
      ),
    { dispatch: false }
  );

  readonly saveCategories$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.storeCategories),
        tap(log),
        tap(({ categories }) => LocalStorageService.put(CATEGORIES, categories)),
        catchError((e) => {
          log(e);
          return EMPTY;
        })
      ),
    { dispatch: false }
  );

  readonly loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadCategories),
      tap<ReturnType<typeof AppActions.loadCategories>>(log),
      tap(() => this.store.dispatch(AppActions.loading({ loading: true }))),
      exhaustMap(() =>
        this.spreadSheetService.getAllCategories().pipe(
          map((categories) => AppActions.storeCategories({ categories })),
          tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
          catchError(reportFailure('loadCategories$', this.store))
        )
      )
    )
  );

  readonly addCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.addCategory),
      tap<ReturnType<typeof AppActions.addCategory>>(log),
      exhaustMap(({ newCategory }) => {
        this.store.dispatch(AppActions.loading({ loading: true }));
        return this.spreadSheetService.addCategory(newCategory).pipe(
          withLatestFrom(this.store.select(categoriesSelector)),
          map(([, categories]) => AppActions.storeCategories({ categories: [...categories, newCategory] })),
          tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
          catchError(reportFailure('addCategory$', this.store))
        );
      })
    )
  );

  readonly deleteCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.deleteCategory),
      tap<ReturnType<typeof AppActions.deleteCategory>>(log),
      withLatestFrom(this.store.select(categoriesSheetIdSelector), this.store.select(categoriesSelector)),
      exhaustMap(([action, sheetId, categories]) => {
        this.store.dispatch(AppActions.loading({ loading: true }));
        const index = categories.findIndex((c) => c.name === action.category.name);
        const deletion$ = !~index
          ? throwError(() => `cannot find category [${action.category.name}]`)
          : (() => {
              const newCategories = [...categories];
              newCategories.splice(index, 1);
              return this.spreadSheetService.deleteSheetRow(sheetId!, index).pipe(map(() => newCategories));
            })();
        return deletion$.pipe(
          map((newCategories) => AppActions.storeCategories({ categories: newCategories })),
          tap(() => this.store.dispatch(AppActions.loading({ loading: false }))),
          catchError(reportFailure('deleteCategory$', this.store))
        );
      })
    )
  );

  private readonly categoriesMemento = new Memento<Category[]>();
  readonly updateCategoryPosition$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.updateCategoryPosition),
      tap<ReturnType<typeof AppActions.updateCategoryPosition>>(log),
      withLatestFrom(this.store.select(categoriesSelector)),
      exhaustMap(([action, categoriesBackUp]) => {
        this.categoriesMemento.save(categoriesBackUp);
        this.store.dispatch(AppActions.loading({ loading: true }));
        this.store.dispatch(AppActions.storeCategories({ categories: action.categories }));
        return this.spreadSheetService.updateCategories(action.categories).pipe(
          map(() => AppActions.loading({ loading: false })),
          catchError((e) => {
            log(e);
            this.store.dispatch(AppActions.storeCategories({ categories: this.categoriesMemento.take() ?? [] }));
            this.store.dispatch(AppActions.loading({ loading: false }));
            this.store.dispatch(
              AppActions.operationFailed({
                source: 'updateCategoryPosition$',
                message: FAILURE_MESSAGES.updateCategoryPosition$
              })
            );
            return EMPTY;
          })
        );
      })
    )
  );

  readonly showFailureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.operationFailed),
        tap(({ message }) =>
          this.snackBar.open(message, 'Dismiss', { politeness: 'assertive', verticalPosition: 'top' })
        )
      ),
    { dispatch: false }
  );

  constructor(
    private readonly store: Store,
    private readonly actions$: Actions,
    private readonly spreadSheetService: SpreadsheetService,
    private readonly snackBar: MatSnackBar
  ) {}
}
