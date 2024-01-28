import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';

import { Store } from '@ngrx/store';
import { BehaviorSubject, Observable, combineLatest, map, mergeMap, switchMap, take } from 'rxjs';

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
  @ViewChild('summaryTable', { read: ElementRef })
  private readonly summaryTable!: ElementRef<HTMLElement>;
  @ViewChild('monthSelector', { read: MatTabGroup })
  private readonly monthSelector!: MatTabGroup;
  private readonly aggregator$ = new BehaviorSubject<AggregatorFn>(groupByCategory);

  // [Jan Feb ... Dec]
  protected readonly monthTabs = new Array(12)
    .fill(0)
    .map((v, i) => new Date(0, i).toLocaleString('default', { month: 'short' }));

  protected readonly expenses$ = this.aggregator$.pipe(
    switchMap((fn) => this.store.select(expensesSelector).pipe(map(fn))),
    mergeMap(this.startViewTransition.bind(this))
  );

  protected sheets: Array<Sheet> = [];
  protected currentSheetIndex = 0;
  protected currentMonthIndex = new Date().getMonth();
  protected tableReversed: boolean = false;

  constructor(private readonly cd: ChangeDetectorRef, private readonly store: Store) {
    this.store.dispatch(AppActions.setTitle({ title: 'Month summary', icon: 'query_stats' }));
    combineLatest([this.store.select(sheetsSelector), this.store.select(currentSheetSelector)])
      .pipe(take(1))
      .subscribe(([sheets, currentSheet]) => {
        this.sheets = sheets;
        this.currentSheetIndex = sheets.indexOf(currentSheet!);
        this.formChanged(this.currentSheetIndex, this.currentMonthIndex, sheets);
      });
  }

  ngAfterViewInit(): void {
    this.scrollToCurrentMonth();
  }

  public tableAnimation(direction: 'reverse' | 'straight' | 'none'): void {
    this.summaryTable?.nativeElement.classList.remove('summary-table-reverse', 'summary-table-straight');
    if (direction === 'none') return;
    this.summaryTable?.nativeElement.classList.add(`summary-table-${direction}`);
  }

  protected formChanged(sheetIndex: number, monthIndex: number, sheets: Array<Sheet>): void {
    this.tableAnimation('none');
    const year = new Date().getFullYear();
    this.store.dispatch(
      AppActions.loadExpenses({
        sheetId: sheets[sheetIndex].id,
        from: new Date(year, monthIndex, 1),
        to: new Date(year, monthIndex + 1, 1)
      })
    );
  }

  protected expensesTableCellClickHandler(event: { field: keyof Expense; cellData: unknown; rowData: Expense }): void {
    if (event.cellData === TOTAL || event.field !== 'category') {
      return;
    }

    if (event.cellData === BACK) {
      this.tableAnimation('reverse');
      this.aggregator$.next(groupByCategory);
      return;
    }

    if (typeof event.cellData === 'string') {
      this.tableAnimation('straight');
      this.aggregator$.next(filterByCategoryName(event.cellData));
    }
  }

  private startViewTransition(data: Array<Expense>): Observable<Array<Expense>> {
    return new Observable((subscriber) => {
      transitionHelper(() => {
        subscriber.next(data);
        subscriber.complete();
        this.cd.detectChanges();
      });
    });
  }

  private scrollToCurrentMonth(): void {
    let { width }: { width: number } = this.monthSelector._elementRef.nativeElement.getBoundingClientRect();
    width -= PADDINGS;
    if (width < this.currentMonthIndex * MONTH_BUTTON_WIDTH) {
      setTimeout(() => (this.monthSelector._tabHeader.scrollDistance = width));
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

function transitionHelper(updateDOM = () => {}): void {
  if (!(document as any).startViewTransition) {
    updateDOM();
    console.warn('View transitions unsupported');
    return;
  }

  (document as any).startViewTransition(updateDOM);
}
