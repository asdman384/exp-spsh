import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTabGroup } from '@angular/material/tabs';
import { By } from '@angular/platform-browser';

import { StatisticsContainer } from './statistics.container';
import { Store, StoreModule } from '@ngrx/store';
import { AppActions } from 'src/@state';
import { metaReducers, reducers } from 'src/@state/app.reducers';
import { Expense, Sheet } from 'src/shared/models';
import { signal } from '@angular/core';
import { StatisticsDataService } from './statistics-data.service';

// `scrollToCurrentMonth` (`statistics.container.ts`) schedules its `_tabHeader.scrollDistance`
// write via a zero-delay `setTimeout`; this waits out that macrotask, mirroring the pattern in
// `expenses-table.component.spec.ts`.
function flushMacrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve));
}

const TEST_SHEET: Sheet = { id: 1, title: 'sheet_2024' };
const SECOND_SHEET: Sheet = { id: 2, title: 'sheet_2025' };
const CURRENT: Expense[] = [
  { category: 'Ресторан', amount: 218.43, comment: 'Lunch', date: new Date(2026, 10, 2) },
  { category: 'Ресторан', amount: 241.67, isInDebt: true, comment: 'Loan', date: new Date(2026, 10, 3) },
  { category: 'Господарські товари', amount: 2735.53 },
  { category: 'TOTAL', amount: 267 },
  { category: 'Zero', amount: 0 },
];
const PREVIOUS: Expense[] = [
  { category: 'Ресторан', amount: 1026.2 },
  { category: 'Медикаменти', amount: 56 },
];

describe('StatisticsContainer', () => {
  let component: StatisticsContainer;
  let fixture: ComponentFixture<StatisticsContainer>;
  let root: HTMLElement;
  let viewTransitionSpy: ReturnType<typeof vi.spyOn>;
  const monthState = signal<{ status: 'loading' | 'ready' | 'error'; current: Expense[]; previous: Expense[] }>({
    status: 'ready',
    current: [],
    previous: [],
  });

  beforeEach(async () => {
    monthState.set({ status: 'ready', current: [], previous: [] });
    await TestBed.configureTestingModule({
      imports: [StatisticsContainer, StoreModule.forRoot(reducers, { metaReducers })],
    })
      .overrideComponent(StatisticsContainer, {
        set: {
          providers: [
            {
              provide: StatisticsDataService,
              useValue: {
                state: monthState,
                load: vi.fn(),
              },
            },
          ],
        },
      })
      .compileComponents();

    const store = TestBed.inject(Store);
    store.dispatch(AppActions.upsertDataSheet({ dataSheet: TEST_SHEET }));
    store.dispatch(AppActions.upsertDataSheet({ dataSheet: SECOND_SHEET }));
    store.dispatch(AppActions.setCurrentSheet({ sheet: TEST_SHEET }));

    // Run the view update synchronously so tests can inspect both branches.
    viewTransitionSpy = vi.spyOn(document, 'startViewTransition').mockImplementation(callbackOptions => {
      if (typeof callbackOptions === 'function') {
        callbackOptions();
      }
      const done = Promise.resolve();
      return {
        ready: done,
        finished: done,
        updateCallbackDone: done,
        skipTransition: () => undefined,
        types: new Set(),
      };
    });

    fixture = TestBed.createComponent(StatisticsContainer);
    component = fixture.componentInstance;
    root = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    viewTransitionSpy.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function showMonth(current: Expense[] = CURRENT, previous: Expense[] = PREVIOUS): void {
    monthState.set({ status: 'ready', current, previous });
    fixture.detectChanges();
  }

  function element<T extends HTMLElement>(selector: string): T {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`Missing element: ${selector}`);
    return found;
  }

  function row(name: string): HTMLTableRowElement {
    return element(`tr[data-category="${name}"]`);
  }

  function checkbox(name: string): HTMLInputElement {
    return element(`.mat-column-select mat-checkbox input[aria-label="Select ${name}"]`);
  }

  function total(selector: string): string {
    return element(selector).textContent.trim();
  }

  function click(target: HTMLElement): void {
    target.click();
    fixture.detectChanges();
  }

  function selectTab(group: number, index: number): void {
    const tabGroup: MatTabGroup = fixture.debugElement.queryAll(By.directive(MatTabGroup))[group].componentInstance;
    tabGroup.selectedIndexChange.emit(index);
    fixture.detectChanges();
  }

  function enterSelection(): void {
    component['unchecked'].set(new Set());
    fixture.detectChanges();
  }

  it('renders separate numeric columns, readable signs, and the previous English tab label', () => {
    const englishTabs = Array.from({ length: 12 }, (_, month) => new Date(2026, month).toLocaleString('en', { month: 'short' }));
    component['monthTabs'].splice(0, 12, ...englishTabs);
    selectTab(2, 10);
    showMonth();
    const headings = () => Array.from(root.querySelectorAll('expenses-table .category-summary th'), cell => cell.textContent.trim());
    expect(headings()).toEqual(['Category', 'Amount', 'Share', 'vs Oct']);
    const cells = (name: string) => Array.from(row(name).cells, cell => cell.textContent.trim());
    expect(cells('Ресторан')).toEqual(['Ресторан', '460,1', '13,3%', '−566,1']);
    expect(cells('Медикаменти')).toEqual(['Медикаменти', '0', '0%', '−56']);
    expect(row('Медикаменти').classList.contains('previous-only')).toBe(true);
    expect(row('Zero').classList.contains('previous-only')).toBe(false);
    expect(cells('TOTAL')[3]).toBe('+267');
    expect(cells('Zero')[3]).toBe('0');
    expect(root.querySelector('input[type="checkbox"]')).toBeNull();
    expect(total('.spending-total > span')).toBe('Spending');
    expect(total('.spending-total strong')).toBe('3\u00a0462,63');
    expect(total('.debt-total > span:first-child')).toBe('Debt');
    expect(total('.debt-total > span:last-child')).toBe('241,67');
    selectTab(2, 0);
    expect(headings()[3]).toBe('vs Dec');
  });

  it('keeps shares and debt constant when selecting none, one, and all categories', () => {
    showMonth();
    enterSelection();
    const header = checkbox('all categories');
    expect(header.checked).toBe(true);
    expect(header.indeterminate).toBe(false);
    const assertTotals = (spending: string) => {
      expect(total('.spending-total strong')).toBe(spending);
      expect(total('.debt-total > span:last-child')).toBe('241,67');
      expect(row('Ресторан').querySelector('.mat-column-share')?.textContent.trim()).toBe('13,3%');
    };

    click(header);
    assertTotals('0');
    expect(checkbox('TOTAL').checked).toBe(false);
    expect(header.indeterminate).toBe(false);
    click(checkbox('TOTAL'));
    assertTotals('267');
    expect(header.checked).toBe(false);
    expect(header.indeterminate).toBe(true);
    click(header);
    assertTotals('3\u00a0462,63');
    expect(header.checked).toBe(true);
    expect(header.indeterminate).toBe(false);
    expect(Array.from(root.querySelectorAll<HTMLInputElement>('td.mat-column-select input'), input => input.checked)).toEqual(
      Array(5).fill(true),
    );
  });

  it('retains a partial selection through details and Back, and counts all category expenses in date order', () => {
    showMonth();
    enterSelection();
    click(checkbox('Ресторан'));
    expect(total('.spending-total strong')).toBe('3\u00a0002,53');
    click(row('Ресторан').querySelector('.mat-column-category button')!);
    expect(viewTransitionSpy).toHaveBeenCalledTimes(1);
    expect(element('.statistics-table').classList.contains('summary-table-straight')).toBe(true);
    expect(total('.statistics-summary h2')).toBe('Ресторан');
    expect(total('.statistics-summary > span')).toBe('460,1');
    expect(Array.from(root.querySelectorAll('expenses-table td.mat-column-comment'), cell => cell.textContent.trim())).toEqual([
      'Loan',
      'Lunch',
    ]);
    expect(root.querySelector('expenses-table input')).toBeNull();
    const back = element<HTMLButtonElement>('[aria-label="Back to categories"]');
    expect(document.activeElement).toBe(back);
    click(back);
    expect(element('.statistics-table').classList.contains('summary-table-reverse')).toBe(true);
    expect(document.activeElement).toBe(row('Ресторан').querySelector('.mat-column-category button'));
    expect(checkbox('Ресторан').checked).toBe(false);
    expect(total('.spending-total strong')).toBe('3\u00a0002,53');
    expect(total('.debt-total > span:last-child')).toBe('241,67');
    click(row('Медикаменти').querySelector('button')!);
    expect(total('.statistics-summary > span')).toBe('0');
    expect(total('.statistics-note')).toBe('No entries for this view.');
    click(element('[aria-label="Back to categories"]'));
    expect(document.activeElement).toBe(row('Медикаменти').querySelector('button'));
    expect(checkbox('Ресторан').checked).toBe(false);
  });

  it('keeps unchecked names on a same-month reload and selects new categories', () => {
    selectTab(2, 10);
    showMonth();
    enterSelection();
    click(checkbox('Ресторан'));
    selectTab(2, 10);
    monthState.set({ status: 'loading', current: [], previous: [] });
    fixture.detectChanges();
    expect(total('.spending-total')).toBe('Spending');
    expect(total('.debt-total')).toBe('Debt');
    expect(element('.spending-total exp-skeleton')).toBeTruthy();
    expect(element('.debt-total exp-skeleton')).toBeTruthy();
    expect(root.querySelector('.statistics-note')).toBeNull();
    showMonth([...CURRENT.map(expense => ({ ...expense })), { category: 'New', amount: 2 }]);
    expect(root.querySelector('exp-skeleton')).toBeNull();
    expect(total('.debt-total > span:last-child')).toBe('241,67');
    expect(checkbox('Ресторан').checked).toBe(false);
    expect(checkbox('New').checked).toBe(true);
    expect(total('.spending-total strong')).toBe('3\u00a0004,53');
  });

  it.each(['sheet', 'month', 'year'])('resets a partial selection on a %s change', context => {
    selectTab(2, 10);
    showMonth();
    enterSelection();
    click(checkbox('Ресторан'));
    if (context === 'sheet')
      selectTab(
        0,
        component['sheets'].findIndex(sheet => sheet.id === SECOND_SHEET.id),
      );
    if (context === 'month') selectTab(2, 9);
    if (context === 'year') selectTab(1, 1);
    expect(root.querySelector('input[type="checkbox"]')).toBeNull();
    expect(total('.spending-total strong')).toBe('3\u00a0462,63');
  });

  it('keeps the totals visible and shows the empty message only for ready data', () => {
    showMonth();
    enterSelection();
    showMonth([], []);
    expect(total('.spending-total strong')).toBe('0');
    expect(checkbox('all categories').disabled).toBe(true);
    expect(total('.statistics-note')).toBe('No entries for this view.');
    monthState.set({ status: 'error', current: [], previous: [] });
    fixture.detectChanges();
    expect(total('.spending-total strong')).toBe('0');
    expect(total('.debt-total > span:last-child')).toBe('0');
    expect(root.querySelector('.statistics-note')).toBeNull();
  });

  it('discards a pending detail transition after a month change', () => {
    selectTab(2, 10);
    showMonth();
    let update: ViewTransitionUpdateCallback | undefined;
    vi.mocked(document.startViewTransition).mockImplementationOnce(options => {
      if (typeof options === 'function') update = options;
      const done = Promise.resolve();
      return { ready: done, finished: done, updateCallbackDone: done, skipTransition: () => undefined, types: new Set() };
    });
    click(row('Ресторан').querySelector('button')!);
    selectTab(2, 9);
    expect(update).toBeTypeOf('function');
    update!();
    expect(root.querySelector('[aria-label="Back to categories"]')).toBeNull();
    expect(element('expenses-table .category-summary')).toBeTruthy();
    expect(total('.spending-total strong')).toBe('3\u00a0462,63');
  });

  it('renders each selected month inside the transition and ignores superseded results', () => {
    selectTab(2, 0);
    showMonth();
    const updates: ViewTransitionUpdateCallback[] = [];
    vi.mocked(document.startViewTransition).mockImplementation(options => {
      if (typeof options === 'function') updates.push(options);
      const done = Promise.resolve();
      return { ready: done, finished: done, updateCallbackDone: done, skipTransition: () => undefined, types: new Set() };
    });

    selectTab(2, 1);
    monthState.set({ status: 'loading', current: [], previous: [] });
    fixture.detectChanges();
    expect(row('TOTAL')).toBeTruthy();
    updates[0]();
    expect(root.querySelector('tr[data-category]')).toBeNull();

    showMonth([{ category: 'February', amount: 20 }], []);
    selectTab(2, 2);
    showMonth([{ category: 'March', amount: 30 }], []);
    expect(updates).toHaveLength(3);
    expect(root.querySelector('tr[data-category]')).toBeNull();
    updates[2]();
    updates[1]();
    expect(row('March')).toBeTruthy();
    expect(root.querySelector('tr[data-category="February"]')).toBeNull();
    expect(total('.spending-total strong')).toBe('30');
  });

  describe('row pointer gestures', () => {
    function pointer(target: Element, type: string, clientY = 0): void {
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 4, isPrimary: true, button: 0, pointerType: 'touch', clientY }),
      );
    }

    function releaseClick(target: Element): boolean {
      const accepted = target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
      fixture.detectChanges();
      return accepted;
    }

    beforeEach(() => {
      showMonth();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.mocked(Element.prototype.setPointerCapture).mockRestore();
      vi.useRealTimers();
    });

    it.each(['category', 'amount', 'share', 'delta'])('opens details once on a short tap in the %s column', column => {
      const cell = row('Ресторан').querySelector(`.mat-column-${column}`)!;
      pointer(cell, 'pointerdown');
      vi.advanceTimersByTime(499);
      pointer(cell, 'pointerup');
      releaseClick(cell);
      expect(viewTransitionSpy).toHaveBeenCalledTimes(1);
      expect(total('.statistics-summary h2')).toBe('Ресторан');
    });

    it.each(['Ресторан', 'Медикаменти'])('selects every row on a stationary hold over %s and consumes the release click', category => {
      const pressed = row(category);
      pointer(pressed, 'pointerdown');
      vi.advanceTimersByTime(500);
      fixture.detectChanges();
      pointer(element('expenses-table'), 'pointerup');
      expect(releaseClick(checkbox(category))).toBe(false);
      expect(checkbox(category).checked).toBe(true);
      expect(checkbox('all categories').checked).toBe(true);
      const next = row('Ресторан');
      pointer(next, 'pointerdown');
      pointer(next, 'pointerup');
      releaseClick(next);
      expect(total('.statistics-summary h2')).toBe('Ресторан');
    });

    it('preserves unchecked rows on another hold', () => {
      enterSelection();
      click(checkbox('TOTAL'));
      const pressed = row('TOTAL');
      pointer(pressed, 'pointerdown');
      vi.advanceTimersByTime(500);
      pointer(pressed, 'pointerup');
      expect(releaseClick(pressed)).toBe(false);
      expect(checkbox('TOTAL').checked).toBe(false);
    });

    it.each(['label', 'cell'])('excludes a hold on the checkbox %s from row gestures', part => {
      enterSelection();
      const cell = row('TOTAL').querySelector<HTMLElement>('.mat-column-select')!;
      const target = part === 'label' ? cell.querySelector('label')! : cell;
      pointer(target, 'pointerdown');
      vi.advanceTimersByTime(500);
      expect(target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))).toBe(true);
      pointer(target, 'pointerup');
      expect(releaseClick(target)).toBe(true);
      expect(checkbox('TOTAL').checked).toBe(part === 'cell');
      expect(viewTransitionSpy).not.toHaveBeenCalled();
    });

    it('keeps a hold active through a same-context refresh of the row objects', () => {
      const pressed = row('Ресторан');
      pointer(pressed, 'pointerdown');
      vi.advanceTimersByTime(250);
      showMonth(CURRENT.map(expense => ({ ...expense })));
      expect(row('Ресторан')).toBe(pressed);
      vi.advanceTimersByTime(250);
      fixture.detectChanges();
      pointer(element('expenses-table'), 'pointerup');
      expect(releaseClick(row('Ресторан'))).toBe(false);
      expect(checkbox('all categories').checked).toBe(true);
    });

    it('keeps a stationary touch active when the native context menu arrives before the hold timer', () => {
      const pressed = row('Ресторан');
      const menu = () => pressed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      expect(menu()).toBe(true);
      pointer(pressed, 'pointerdown');
      vi.advanceTimersByTime(490);
      expect(menu()).toBe(false);
      expect(root.querySelector('input[type="checkbox"]')).toBeNull();
      vi.advanceTimersByTime(10);
      fixture.detectChanges();
      pointer(element('expenses-table'), 'pointerup');
      expect(releaseClick(row('Ресторан'))).toBe(false);
      expect(checkbox('all categories').checked).toBe(true);
    });

    it.each(['pointermove', 'pointercancel', 'lostpointercapture'])('cancels the hold and tap on %s', type => {
      const pressed = row('Ресторан');
      pointer(pressed, 'pointerdown');
      pointer(pressed, type, 12);
      vi.advanceTimersByTime(600);
      pointer(pressed, 'pointerup', 12);
      expect(releaseClick(pressed)).toBe(false);
      expect(root.querySelector('input[type="checkbox"]')).toBeNull();
      expect(root.querySelector('[aria-label="Back to categories"]')).toBeNull();
      expect(row('Ресторан')).toBeTruthy();
    });

    it('cancels a pending hold when the month changes', () => {
      selectTab(2, 10);
      pointer(row('Ресторан'), 'pointerdown');
      selectTab(2, 9);
      vi.advanceTimersByTime(600);
      fixture.detectChanges();
      expect(root.querySelector('input[type="checkbox"]')).toBeNull();
      expect(root.querySelector('[aria-label="Back to categories"]')).toBeNull();
      expect(row('Ресторан')).toBeTruthy();
    });
  });

  // [AC15] `tableAnimation()` still adds/removes the right CSS classes on the summary table
  // element for each direction, reading the migrated optional `summaryTable` viewChild.
  describe('tableAnimation() class toggling', () => {
    function summaryTableClasses(): DOMTokenList {
      return (fixture.debugElement.query(By.css('.statistics-table')).nativeElement as HTMLElement).classList;
    }

    it('should_add_summary_table_straight_class_and_remove_reverse_when_direction_is_straight', () => {
      component.tableAnimation('reverse');
      expect(summaryTableClasses().contains('summary-table-reverse')).toBe(true);

      component.tableAnimation('straight');

      expect(summaryTableClasses().contains('summary-table-straight')).toBe(true);
      expect(summaryTableClasses().contains('summary-table-reverse')).toBe(false);
    });

    it('should_add_summary_table_reverse_class_and_remove_straight_when_direction_is_reverse', () => {
      component.tableAnimation('straight');
      expect(summaryTableClasses().contains('summary-table-straight')).toBe(true);

      component.tableAnimation('reverse');

      expect(summaryTableClasses().contains('summary-table-reverse')).toBe(true);
      expect(summaryTableClasses().contains('summary-table-straight')).toBe(false);
    });

    it('should_remove_both_animation_classes_and_add_none_when_direction_is_none', () => {
      component.tableAnimation('straight');
      expect(summaryTableClasses().contains('summary-table-straight')).toBe(true);

      component.tableAnimation('none');

      expect(summaryTableClasses().contains('summary-table-straight')).toBe(false);
      expect(summaryTableClasses().contains('summary-table-reverse')).toBe(false);
    });
  });

  // [AC15 / D6] The optional `summaryTable` viewChild must not throw when read before the view
  // exists — the constructor's `formChanged` -> `tableAnimation('none')` path relies on this.
  describe('tableAnimation() called before the view exists', () => {
    it('should_not_throw_when_summaryTable_query_has_not_resolved_yet', () => {
      // A fresh fixture whose `detectChanges()` has never run: the template has not been
      // created, so the `#summaryTable` viewChild query cannot have resolved yet.
      const freshFixture = TestBed.createComponent(StatisticsContainer);

      expect(() => freshFixture.componentInstance.tableAnimation('straight')).not.toThrow();
    });
  });

  // [AC16] [AC17] `monthSelector` is a required signal viewChild read from `ngAfterViewInit`;
  // reading it must not throw `NG0951`, and `scrollToCurrentMonth`'s scroll write must still run
  // for a month index late enough that the carousel needs to scroll.
  describe('scrollToCurrentMonth via ngAfterViewInit', () => {
    it('should_scroll_month_tab_header_for_a_late_month_index_without_throwing_NG0951', async () => {
      // Force the "carousel does not fit" branch deterministically regardless of the headless
      // browser's actual viewport: every element reports a zero-width bounding rect, so
      // `width (0) - PADDINGS (76) = -76` is always less than `currentMonthIndex * MONTH_BUTTON_WIDTH`.
      const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      try {
        const freshFixture = TestBed.createComponent(StatisticsContainer);
        // December: a month index late enough to need scrolling, set before the view (and thus
        // `ngAfterViewInit`) is created by the first `detectChanges()`.
        (freshFixture.componentInstance as unknown as { currentMonthIndex: number }).currentMonthIndex = 11;

        expect(() => freshFixture.detectChanges()).not.toThrow();

        const monthGroup = freshFixture.debugElement.query(By.css('.carousel-selector-month')).componentInstance as MatTabGroup;
        const scrollDistanceSpy = vi.spyOn(monthGroup._tabHeader, 'scrollDistance', 'set');

        await flushMacrotasks();

        expect(scrollDistanceSpy).toHaveBeenCalledWith(-76);
      } finally {
        rectSpy.mockRestore();
      }
    });
  });
});
