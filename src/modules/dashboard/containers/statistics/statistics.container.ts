import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';

import { Store } from '@ngrx/store';
import { BehaviorSubject, filter, map, switchMap } from 'rxjs';

import { AppActions, currentSheetSelector, expensesSelector, sheetsSelector } from 'src/@state';
import { BACK, TOTAL } from 'src/constants';
import { Expense } from 'src/shared/models';

@Component({
  selector: 'exp-statistics-container',
  templateUrl: './statistics.container.html',
  styleUrl: './statistics.container.scss'
})
export class StatisticsContainer implements AfterViewInit {
  @ViewChild('form', { static: true, read: NgForm })
  private readonly form!: NgForm;
  private readonly aggregator$ = new BehaviorSubject<AggregatorFn>(groupByCategory);
  readonly sheets$ = this.store.select(sheetsSelector);
  readonly sheet$ = this.store.select(currentSheetSelector);
  readonly expenses$ = this.aggregator$.pipe(switchMap((fn) => this.store.select(expensesSelector).pipe(map(fn))));
  readonly monthModel: number = new Date().getMonth();
  readonly month = 'month';
  readonly sheet = 'sheet';

  constructor(private readonly store: Store) {}

  ngAfterViewInit(): void {
    this.form.form.valueChanges
      .pipe(filter((x) => x[this.month] !== undefined && x[this.sheet] !== undefined))
      .subscribe((formValue) => {
        log('StatisticsContainer::form.valueChanges', formValue);
        const year = new Date().getFullYear();
        this.store.dispatch(
          AppActions.loadExpenses({
            sheetId: formValue[this.sheet].id,
            from: new Date(year, formValue[this.month], 1),
            to: new Date(year, formValue[this.month] + 1, 1)
          })
        );
      });
  }

  expensesTableCellClickHandler(event: { field: keyof Expense; cellData: unknown; rowData: Expense }): void {
    log('expensesTableCellClickHandler', event);
    if (event.cellData === TOTAL || event.field !== 'category') {
      return;
    }

    if (event.cellData === BACK) {
      this.aggregator$.next(groupByCategory);
      return;
    }

    if (typeof event.cellData === 'string') {
      this.aggregator$.next(filterByCategoryName(event.cellData));
    }
  }
}

type AggregatorFn = (data: Array<Expense>) => Array<Expense>;

function filterByCategoryName(categoryName: string): AggregatorFn {
  return function (data: Array<Expense>): Array<Expense> {
    const result = data
      .filter((d) => d.category === categoryName)
      .sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return b.date?.getTime() - a.date?.getTime();
      });
    result.push({ category: BACK });
    return result;
  };
}

function groupByCategory(data: Array<Expense>): Array<Expense> {
  return sumByAmount(groupBy(data, 'category'));
}

function groupBy<T extends { [key: string]: any }>(xs: Array<T>, key: keyof T): { [key: string]: Array<T> } {
  return xs.reduce(function (rv, x) {
    const aggr = x[key as keyof T];
    if (typeof aggr === 'string') {
      (rv[aggr] = rv[aggr] || []).push(x);
    }
    return rv;
  }, {} as { [key: string]: Array<T> });
}

function sumByAmount(xs: { [key: string]: Array<Expense> }): Array<Expense> {
  const result: Array<Expense> = [];
  for (const field in xs) {
    result.push({
      category: field,
      amount: xs[field].reduce((p, c) => p + Number(c.amount), 0)
    });
  }

  result.push({
    category: TOTAL,
    amount: result.reduce((p, c) => p + Number(c.amount), 0)
  });

  return result;
}
