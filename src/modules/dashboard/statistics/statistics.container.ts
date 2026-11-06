import '@angular/common/locales/global/pl';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabGroup, MatTabsModule } from '@angular/material/tabs';

import { Store } from '@ngrx/store';
import { BehaviorSubject, Observable, combineLatest, map, switchMap, take } from 'rxjs';

import { AppActions, currentSheetSelector, sheetsSelector } from 'src/@state';
import { ExpensesTableComponent } from 'src/shared/components';
import { Expense, ExpenseTableRow, Sheet } from 'src/shared/models';
import { StatisticsDataService } from './statistics-data.service';
import { categoryName, summarizeMonth } from './statistics-summary';

const MONTH_BUTTON_WIDTH = 50;
const PADDINGS = 76;

@Component({
  selector: 'exp-statistics-container',
  templateUrl: './statistics.container.html',
  styleUrl: './statistics.container.scss',
  imports: [FormsModule, AsyncPipe, DecimalPipe, MatButtonModule, MatIconModule, MatTabsModule, ExpensesTableComponent],
  providers: [StatisticsDataService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsContainer implements AfterViewInit {
  private readonly store = inject(Store);
  protected readonly data = inject(StatisticsDataService);
  protected readonly debtTotal = computed(() => this.data.state().current
    .filter((row) => row.isInDebt)
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0));
  private readonly expensesList$ = toObservable(this.data.state);
  private readonly summaryTable = viewChild<unknown, ElementRef<HTMLElement>>('summaryTable', { read: ElementRef });
  private readonly monthSelector = viewChild.required('monthSelector', { read: MatTabGroup });
  private readonly aggregator$ = new BehaviorSubject<AggregatorFn>(groupByCategory);

  // [Jan Feb ... Dec]
  protected readonly monthTabs = new Array(12)
    .fill(0)
    .map((v, i) => new Date(0, i).toLocaleString('default', { month: 'short' }));

  // [2024, 2023 ... 2019]
  protected readonly yearsTabs = new Array(new Date().getFullYear() - 2018)
    .fill(0)
    .map((v, i) => new Date().getFullYear() - i);

  protected readonly expenses$ = this.aggregator$.pipe(
    switchMap((fn) => this.expensesList$.pipe(map(fn))),
    switchMap(this.startViewTransition.bind(this))
  );

  protected sheets: Array<Sheet> = [];
  protected currentSheetIndex = 0;
  protected currentYearIndex = 0;
  protected currentMonthIndex = new Date().getMonth();
  protected tableReversed: boolean = false;
  protected selectable = true;
  protected selectedCategory?: string;
  protected total = 0;

  constructor() {
    this.store.dispatch(AppActions.setTitle({ title: 'Month summary', icon: 'query_stats' }));
    combineLatest([this.store.select(sheetsSelector), this.store.select(currentSheetSelector)])
      .pipe(take(1))
      .subscribe(([sheets, currentSheet]) => {
        this.sheets = sheets;
        this.currentSheetIndex = sheets.indexOf(currentSheet!);
        this.formChanged(this.currentSheetIndex, this.currentYearIndex, this.currentMonthIndex, sheets);
      });
  }

  ngAfterViewInit(): void {
    this.scrollToCurrentMonth();
  }

  public tableAnimation(direction: 'reverse' | 'straight' | 'none'): void {
    this.summaryTable()?.nativeElement.classList.remove('summary-table-reverse', 'summary-table-straight');
    if (direction === 'none') return;
    this.summaryTable()?.nativeElement.classList.add(`summary-table-${direction}`);
  }

  protected formChanged(sheetIndex: number, yearIndex: number, monthIndex: number, sheets: Array<Sheet>): void {
    this.tableAnimation('none');
    this.selectedCategory = undefined;
    this.selectable = true;
    this.total = 0;
    this.aggregator$.next(groupByCategory);
    const year = this.yearsTabs[yearIndex];
    const sheet = sheets[sheetIndex];
    if (sheet) this.data.load(sheet.id, year, monthIndex);
  }

  protected expensesTableCellClickHandler(event: { field: keyof Expense; cellData: unknown; rowData: Expense }): void {
    if (event.field !== 'category') {
      return;
    }

    if (typeof event.cellData === 'string') {
      this.selectable = false;
      this.tableAnimation('straight');
      this.selectedCategory = event.cellData;
      this.aggregator$.next(filterByCategoryName(this.selectedCategory));
    }
  }

  protected onSelection(data: ReadonlyArray<Expense>): void {
    this.total = data.reduce((p, c) => p + Number(c.amount), 0);
  }

  protected unCategory(): void {
    this.selectedCategory = undefined;
    this.selectable = true;
    this.tableAnimation('reverse');
    this.aggregator$.next(groupByCategory);
  }

  private startViewTransition(data: Array<ExpenseTableRow>): Observable<Array<ExpenseTableRow>> {
    return new Observable((subscriber) => {
      transitionHelper(() => {
        subscriber.next(data);
        subscriber.complete();
      });
    });
  }

  private scrollToCurrentMonth(): void {
    let { width }: { width: number } = this.monthSelector()._elementRef.nativeElement.getBoundingClientRect();
    width -= PADDINGS;
    if (width < this.currentMonthIndex * MONTH_BUTTON_WIDTH) {
      setTimeout(() => (this.monthSelector()._tabHeader.scrollDistance = width));
    }
  }
}

interface MonthRows { current: Expense[]; previous: Expense[] }
type AggregatorFn = (data: MonthRows) => ExpenseTableRow[];

function filterByCategoryName(name: string): AggregatorFn {
  return ({ current }) => current
    .filter((row) => categoryName(row) === name)
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .map((row) => ({ amount: row.amount, comment: row.comment, date: row.date }));
}

function groupByCategory({ current, previous }: MonthRows): ExpenseTableRow[] {
  return summarizeMonth(current, previous).spending;
}

function transitionHelper(updateDOM: () => void): void {
  if (!document.startViewTransition) {
    updateDOM();
    console.warn('View transitions unsupported');
    return;
  }

  document.startViewTransition(updateDOM);
}
