import { AfterViewInit, ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';

import { Store } from '@ngrx/store';
import { first } from 'rxjs';

import { AppActions, categoriesSelector, expensesSelector, loadingSelector } from 'src/@state';
import { SecurityService } from 'src/services';
import { Expense } from 'src/shared/models';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.container.html',
  styleUrl: './dashboard-page.container.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageContainer {
  readonly loading$ = this.store.select(loadingSelector);
  readonly usersLookup: Array<{ name?: string; value?: string }> = [];
  readonly categories$ = this.store.select(categoriesSelector);
  readonly expenses$ = this.store.select(expensesSelector);

  expense: Expense = { date: new Date(), userId: '' };

  constructor(private readonly store: Store, private readonly security: SecurityService) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard' }));
    this.store.dispatch(AppActions.loadExpenses({}));
    this.security.user$.pipe(first()).subscribe((user) => {
      if (!user) return;
      this.expense.userId = user.id!;
      this.usersLookup.push({ name: user.name, value: user.id });
    });
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) {
      return;
    }
    const userId = form.value['userId'];
    this.store.dispatch(AppActions.addExpense({ expense: form.value as Expense }));
    form.resetForm({ date: new Date(), userId, amount: undefined, category: undefined, comment: undefined });
    log(form.value);
  }
}
