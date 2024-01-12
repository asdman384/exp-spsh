import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';

import { Store } from '@ngrx/store';
import { BehaviorSubject, combineLatest, map, switchMap, take } from 'rxjs';

import { AppActions, currentSheetSelector, expensesSelector, sheetsSelector } from 'src/@state';
import { BACK, TOTAL } from 'src/constants';
import { Expense, Sheet } from 'src/shared/models';

const MONTH_BUTTON_WIDTH = 50;
const PADDINGS = 76;

@Component({
  selector: 'exp-statistics-container',
  templateUrl: './statistics.container.html',
  styleUrl: './statistics.container.scss'
})
export class StatisticsContainer implements AfterViewInit {
  @ViewChild('monthSelector', { read: MatTabGroup })
  private readonly monthSelector!: MatTabGroup;
  private readonly aggregator$ = new BehaviorSubject<AggregatorFn>(groupByCategory);
  readonly month = 'month';
  readonly sheet = 'sheet';

  readonly sheets$ = this.store.select(sheetsSelector);
  readonly sheet$ = this.store.select(currentSheetSelector);

  readonly monthTabs = new Array(12)
    .fill(0)
    .map((v, i) => new Date(2024, i).toLocaleString('default', { month: 'short' }));
  readonly monthModel: number = new Date().getMonth();

  readonly expenses$ = this.aggregator$.pipe(switchMap((fn) => this.store.select(expensesSelector).pipe(map(fn))));

  sheets: Array<Sheet> = [];
  currentSheetIndex = 0;
  currentMonthIndex = new Date().getMonth();

  constructor(private readonly store: Store) {
    combineLatest([this.sheets$, this.sheet$])
      .pipe(take(1))
      .subscribe(([sheets, sheet]) => {
        this.sheets = sheets;
        this.currentSheetIndex = sheets.indexOf(sheet!);
        this.formChanged(this.currentSheetIndex, this.currentMonthIndex, sheets);
      });
  }

  ngAfterViewInit(): void {
    this.scrollToCurrentMonth();
  }

  formChanged(sheetIndex: number, monthIndex: number, sheets: Array<Sheet>): void {
    const year = new Date().getFullYear();
    this.store.dispatch(
      AppActions.loadExpenses({
        sheetId: sheets[sheetIndex].id,
        from: new Date(year, monthIndex, 1),
        to: new Date(year, monthIndex + 1, 1)
      })
    );
  }

  private scrollToCurrentMonth(): void {
    let { width }: { width: number } = this.monthSelector._elementRef.nativeElement.getBoundingClientRect();
    width -= PADDINGS;
    if (width < this.currentMonthIndex * MONTH_BUTTON_WIDTH) {
      setTimeout(() => (this.monthSelector._tabHeader.scrollDistance = width));
    }
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
