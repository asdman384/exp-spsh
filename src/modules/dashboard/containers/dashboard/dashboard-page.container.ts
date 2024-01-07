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

  minDate: Date = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0);
  maxDate: Date = new Date();
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
    const date = form.value['date'] as Date;
    this.store.dispatch(AppActions.addExpense({ expense: form.value as Expense, sheetId: sheet.id }));
    form.resetForm({ date, sheet, amount: undefined, category: undefined, comment: undefined });
  }

  onSheetChange(sheet: Sheet): void {
    log('DashboardPageContainer::onSheetChange', sheet);
    this.store.dispatch(AppActions.loadExpenses({ sheetId: sheet!.id }));
  }

  onDateChange(date: Date): void {
    log('DashboardPageContainer::onDateChange', date);

    if (!this.sheet) {
      return;
    }
    const to = new Date(date);
    to.setDate(to.getDate() + 1); // add a day

    this.store.dispatch(AppActions.loadExpenses({ sheetId: this.sheet.id, from: date, to }));

    const currentTime = new Date(date);
    currentTime.setHours(new Date().getHours(), new Date().getMinutes());
    this.expense.date = currentTime;
  }

  loadCategories(): void {
    this.store.dispatch(AppActions.loadCategories());
  }

  updateMaxDate(): void {
    this.maxDate = new Date();
  }
}
