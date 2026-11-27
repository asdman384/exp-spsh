import '@angular/common/locales/global/pl';
import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  Renderer2,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabGroup, MatTabsModule } from '@angular/material/tabs';

import { Store } from '@ngrx/store';
import { combineLatest, take } from 'rxjs';

import { AppActions, currentSheetSelector, sheetsSelector } from 'src/@state';
import { ExpensesTableComponent, SkeletonComponent } from 'src/shared/components';
import { Sheet } from 'src/shared/models';
import { StatisticsDataService } from './statistics-data.service';
import { categoryName, summarizeMonth } from './statistics-summary';

const MONTH_BUTTON_WIDTH = 50;
const PADDINGS = 76;
const HOLD_DELAY = 500;
const MOVE_TOLERANCE = 8;

interface RowPress {
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
  captureTarget: HTMLElement;
  timer: ReturnType<typeof setTimeout>;
}

@Component({
  selector: 'exp-statistics-container',
  host: {
    '[class.category-view]': 'selectedCategory() !== undefined',
    '[class.summary-view]': 'selectedCategory() === undefined',
  },
  templateUrl: './statistics.container.html',
  styleUrl: './statistics.container.scss',
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatTabsModule, ExpensesTableComponent, SkeletonComponent],
  providers: [StatisticsDataService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsContainer implements AfterViewInit {
  private readonly store = inject(Store);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(StatisticsDataService);
  // Keep the old rows on screen until the browser captures the outgoing view.
  protected readonly monthData = signal(this.data.state());
  protected readonly selectedCategory = signal<string | undefined>(undefined);
  protected readonly summaryRows = computed(() => {
    const { current, previous } = this.monthData();
    return summarizeMonth(current, previous).spending;
  });
  protected readonly unchecked = signal<ReadonlySet<string> | null>(null);
  protected readonly checkedRows = computed(() => this.summaryRows().filter(row => !this.unchecked()?.has(row.category)));
  protected readonly summaryTotal = computed(() => this.checkedRows().reduce((sum, row) => sum + row.amount, 0));
  protected readonly allChecked = computed(() => this.checkedRows().length > 0 && this.checkedRows().length === this.summaryRows().length);
  protected readonly detailRows = computed(() => {
    const category = this.selectedCategory();
    return this.monthData()
      .current.filter(row => categoryName(row) === category)
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
      .map(({ amount, comment, date }) => ({ amount, comment, date }));
  });
  protected readonly detailTotal = computed(() => this.detailRows().reduce((sum, row) => sum + Number(row.amount ?? 0), 0));
  protected readonly debtTotal = computed(() =>
    this.monthData()
      .current.filter(row => row.isInDebt)
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
  );
  private readonly summaryTable = viewChild<unknown, ElementRef<HTMLElement>>('summaryTable', { read: ElementRef });
  private readonly monthSelector = viewChild.required('monthSelector', { read: MatTabGroup });
  private readonly backButton = viewChild('backButton', { read: ElementRef<HTMLButtonElement> });
  private context?: { sheetId: number; year: number; month: number };
  private animateMonthChange = false;
  private press?: RowPress;
  private suppressClick = false;
  private navigationId = 0;

  // [Jan Feb ... Dec]
  protected readonly monthTabs = new Array(12).fill(0).map((v, i) => new Date(0, i).toLocaleString('default', { month: 'short' }));

  // [2024, 2023 ... 2019]
  protected readonly yearsTabs = new Array(new Date().getFullYear() - 2018).fill(0).map((v, i) => new Date().getFullYear() - i);

  protected sheets: Array<Sheet> = [];
  protected currentSheetIndex = 0;
  protected currentYearIndex = 0;
  protected currentMonthIndex = new Date().getMonth();

  constructor() {
    effect(() => {
      const month = this.data.state();
      if (!this.animateMonthChange || !document.startViewTransition) {
        this.monthData.set(month);
        return;
      }
      if (month.status !== 'loading') this.animateMonthChange = false;
      document.startViewTransition(() => {
        if (this.destroyRef.destroyed || this.data.state() !== month) return;
        this.monthData.set(month);
        this.changeDetector.detectChanges();
      });
    });
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
    // Capture runs before the release click can activate a checkbox inserted by the hold.
    const unlisten = this.renderer.listen(this.summaryTable()!.nativeElement, 'click', (event: MouseEvent) => this.clickRow(event), {
      capture: true,
    });
    this.destroyRef.onDestroy(() => {
      unlisten();
      this.clearPress();
    });
    this.scrollToCurrentMonth();
  }

  public tableAnimation(direction: 'reverse' | 'straight' | 'none'): void {
    this.summaryTable()?.nativeElement.classList.remove('summary-table-reverse', 'summary-table-straight');
    if (direction === 'none') return;
    this.summaryTable()?.nativeElement.classList.add(`summary-table-${direction}`);
  }

  protected formChanged(sheetIndex: number, yearIndex: number, monthIndex: number, sheets: Array<Sheet>): void {
    const year = this.yearsTabs[yearIndex];
    const sheet = sheets[sheetIndex];
    if (!sheet) return;
    if (this.context?.sheetId !== sheet.id || this.context.year !== year || this.context.month !== monthIndex) {
      this.animateMonthChange = this.context !== undefined;
      this.context = { sheetId: sheet.id, year, month: monthIndex };
      this.navigationId++;
      this.cancelPress();
      this.tableAnimation('none');
      this.selectedCategory.set(undefined);
      this.unchecked.set(null);
    }
    this.data.load(sheet.id, year, monthIndex);
  }

  protected toggleSelection(category: string | null): void {
    if (category === null) {
      this.unchecked.set(new Set(this.allChecked() ? this.summaryRows().map(row => row.category) : []));
      return;
    }
    const unchecked = new Set(this.unchecked());
    if (unchecked.has(category)) unchecked.delete(category);
    else unchecked.add(category);
    this.unchecked.set(unchecked);
  }

  protected startPress(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) return;
    this.clearPress();
    this.suppressClick = false;
    const target = event.target as Element;
    const row = target.closest<HTMLTableRowElement>('tr[data-category]');
    if (!row || target.closest('.mat-column-select')) return;
    const host = event.currentTarget as HTMLElement;
    row.setPointerCapture(event.pointerId);
    this.press = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      captureTarget: row,
      timer: setTimeout(() => {
        if (!this.press) return;
        if (!row.isConnected) {
          this.cancelPress();
          return;
        }
        this.suppressClick = true;
        if (this.unchecked() === null) {
          // Adding the checkbox column replaces the Material rows. Keep capture on the table host until release.
          this.press.captureTarget = host;
          host.setPointerCapture(event.pointerId);
          this.unchecked.set(new Set());
        }
      }, HOLD_DELAY),
    };
  }

  protected movePress(event: PointerEvent): void {
    if (this.press?.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > MOVE_TOLERANCE) this.cancelPress();
  }

  protected finishPress(event: PointerEvent): void {
    if (this.press?.pointerId !== event.pointerId) return;
    this.movePress(event);
    this.clearPress();
  }

  protected cancelPress(event?: PointerEvent): void {
    if (!this.press || (event && event.pointerId !== this.press.pointerId)) return;
    if (event?.type === 'lostpointercapture' && event.target !== this.press.captureTarget) return;
    this.suppressClick = true;
    this.clearPress();
  }

  protected handleContextMenu(event: MouseEvent): void {
    // A native touch menu can arrive before the 500 ms hold timer expires.
    const press = this.press;
    if (!press || press.pointerType === 'mouse') return;
    if (event instanceof PointerEvent && event.pointerType !== press.pointerType) return;
    if (press.captureTarget.contains(event.target as Node)) event.preventDefault();
  }

  private clearPress(): void {
    const press = this.press;
    if (!press) return;
    this.press = undefined;
    clearTimeout(press.timer);
    if (press.captureTarget.hasPointerCapture(press.pointerId)) press.captureTarget.releasePointerCapture(press.pointerId);
  }

  private clickRow(event: MouseEvent): void {
    const pointerClick = event.detail > 0 || (event instanceof PointerEvent && event.pointerType !== '');
    if (this.suppressClick && pointerClick) {
      this.suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const target = event.target as Element;
    const category = target.closest<HTMLElement>('tr[data-category]')?.dataset['category'];
    if (category !== undefined && !target.closest('.mat-column-select')) this.showCategory(category, !pointerClick);
  }

  protected showCategory(category: string | undefined, keyboard = false): void {
    this.suppressClick = false;
    const previous = this.selectedCategory();
    const id = ++this.navigationId;
    this.tableAnimation(category === undefined ? 'reverse' : 'straight');
    const update = () => {
      if (this.destroyRef.destroyed || id !== this.navigationId) return;
      this.selectedCategory.set(category);
      this.changeDetector.detectChanges();
      if (keyboard) {
        if (category !== undefined) this.backButton()?.nativeElement.focus();
        else if (previous !== undefined) {
          this.summaryTable()
            ?.nativeElement.querySelector<HTMLButtonElement>(`tr[data-category="${CSS.escape(previous)}"] .mat-column-category button`)
            ?.focus();
        }
      }
    };
    if (document.startViewTransition) {
      document.startViewTransition(update);
    } else {
      update();
    }
  }

  private scrollToCurrentMonth(): void {
    let { width }: { width: number } = this.monthSelector()._elementRef.nativeElement.getBoundingClientRect();
    width -= PADDINGS;
    if (width < this.currentMonthIndex * MONTH_BUTTON_WIDTH) {
      setTimeout(() => (this.monthSelector()._tabHeader.scrollDistance = width));
    }
  }
}
