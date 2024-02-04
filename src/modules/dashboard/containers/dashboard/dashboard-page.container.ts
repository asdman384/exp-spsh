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
import { TIME_FORMAT } from 'src/constants';
import { Expense, Sheet } from 'src/shared/models';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.container.html',
  styleUrl: './dashboard-page.container.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageContainer {
  protected readonly loading$ = this.store.select(loadingSelector);
  protected readonly sheets$ = this.store.select(sheetsSelector);
  protected readonly categories$ = this.store.select(categoriesSelector);
  protected readonly expenses$ = this.store.select(expensesSelector);
  protected readonly timeFormat = TIME_FORMAT;

  protected minDate: Date = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0);
  protected sheet?: Sheet;
  protected expense: Expense = { date: new Date() };

  constructor(private readonly store: Store) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard', icon: 'dashboard' }));
    this.store
      .select(currentSheetSelector)
      .pipe(first())
      .pipe(tap((sheet) => this.store.dispatch(AppActions.loadExpenses({ sheetId: sheet!.id }))))
      .subscribe((sheet) => (this.sheet = sheet));
  }

  protected onSubmit(form: NgForm): void {
    if (!form.valid) {
      return;
    }
    log('DashboardPageContainer::onSubmit', form.value);
    const sheet = form.value['sheet'] as Sheet;
    const date = form.value['date'] as Date;
    this.store.dispatch(AppActions.addExpense({ expense: form.value as Expense, sheetId: sheet.id }));
    form.resetForm({ date, sheet, amount: undefined, category: undefined, comment: undefined });
  }

  protected onSheetChange(sheet: Sheet): void {
    log('DashboardPageContainer::onSheetChange', sheet);
    this.store.dispatch(AppActions.loadExpenses({ sheetId: sheet.id, ...this.getInterval(this.expense.date!) }));
  }

  protected onDateChange(date: Date): void {
    log('DashboardPageContainer::onDateChange', date);
    if (!this.sheet) {
      return;
    }

    this.store.dispatch(AppActions.loadExpenses({ sheetId: this.sheet.id, ...this.getInterval(date) }));

    const currentTime = new Date(date);
    currentTime.setHours(new Date().getHours(), new Date().getMinutes());
    this.expense.date = currentTime;
  }

  protected loadCategories(): void {
    this.store.dispatch(AppActions.loadCategories());
  }

  protected handleDeleteExpense(expense: Expense): void {
    if (!this.sheet) {
      return;
    }

    this.store.dispatch(AppActions.deleteExpense({ expense, sheet: this.sheet }));
  }

  private getInterval(from: Date): { from: Date; to?: Date } {
    const currentMonth = new Date().getMonth();
    const currentDay = new Date().getDate();

    if (from.getMonth() === currentMonth && from.getDate() === currentDay) {
      return { from };
    }

    const to = new Date(from);
    to.setDate(to.getDate() + 1); // add a day
    return { from, to };
  }
}
