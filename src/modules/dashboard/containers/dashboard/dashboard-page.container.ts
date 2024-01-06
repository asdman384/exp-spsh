import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgForm } from '@angular/forms';

import { Store } from '@ngrx/store';
import { first, tap } from 'rxjs';

import {
  AppActions,
  categoriesSelector,
  currentSheetSelector,
  expensesSelector,
  loadingSelector,
  sheetsSelector
} from 'src/@state';
import { Expense, Sheet } from 'src/shared/models';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.container.html',
  styleUrl: './dashboard-page.container.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageContainer {
  readonly loading$ = this.store.select(loadingSelector);
  readonly sheets$ = this.store.select(sheetsSelector);
  readonly categories$ = this.store.select(categoriesSelector);
  readonly expenses$ = this.store.select(expensesSelector);

  sheet?: Sheet;
  expense: Expense = { date: new Date() };

  constructor(private readonly store: Store) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard' }));
    this.store
      .select(currentSheetSelector)
      .pipe(first())
      .pipe(tap((sheet) => this.store.dispatch(AppActions.loadExpenses({ sheetId: sheet!.id }))))
      .subscribe((sheet) => (this.sheet = sheet));
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) {
      return;
    }
    log('DashboardPageContainer::onSubmit', form.value);
    const sheet = form.value['sheet'] as Sheet;
    this.store.dispatch(AppActions.addExpense({ expense: form.value as Expense, sheetId: sheet.id }));
    form.resetForm({ date: new Date(), sheet, amount: undefined, category: undefined, comment: undefined });
  }

  onSheetChange(sheet: Sheet): void {
    log('DashboardPageContainer::onSheetChange', sheet);
    this.store.dispatch(AppActions.loadExpenses({ sheetId: sheet!.id }));
  }

  loadCategories(): void {
    this.store.dispatch(AppActions.loadCategories());
  }
}
