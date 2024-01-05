import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';

import { Store } from '@ngrx/store';
import { first, firstValueFrom, map } from 'rxjs';

import { AppActions, categoriesSelector, loadingSelector, sheetIdSelector, spreadsheetIdSelector } from 'src/@state';
import { SecurityService, SpreadsheetService } from 'src/services';
import { Expense } from 'src/shared/models';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.container.html',
  styleUrl: './dashboard-page.container.scss'
})
export class DashboardPageContainer {
  readonly loading$ = this.store.select(loadingSelector);
  readonly usersLookup: Array<{ name?: string; value?: string }> = [];
  readonly categories$ = this.store.select(categoriesSelector);

  expense: Expense = {
    date: new Date(),
    userId: '',
    amount: undefined,
    category: undefined,
    comment: undefined
  };

  constructor(
    private readonly store: Store,
    private readonly spreadsheetService: SpreadsheetService,
    private readonly security: SecurityService
  ) {
    this.store.dispatch(AppActions.setTitle({ title: 'Dashboard' }));
    security.user$.pipe(first()).subscribe((user) => {
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

  async get(): Promise<void> {
    const spreadsheetId = await firstValueFrom(this.store.select(spreadsheetIdSelector));
    const sheetId = await firstValueFrom(this.store.select(sheetIdSelector));

    this.spreadsheetService.getData(spreadsheetId!, sheetId!);
  }
}
