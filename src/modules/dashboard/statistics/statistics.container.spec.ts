import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTabGroup } from '@angular/material/tabs';
import { By } from '@angular/platform-browser';

import { StatisticsContainer } from './statistics.container';
import { FormsModule } from '@angular/forms';
import { Store, StoreModule } from '@ngrx/store';
import { AppActions } from 'src/@state';
import { metaReducers, reducers } from 'src/@state/app.reducers';
import { Sheet } from 'src/shared/models';

// `scrollToCurrentMonth` (`statistics.container.ts`) schedules its `_tabHeader.scrollDistance`
// write via a zero-delay `setTimeout`; this waits out that macrotask, mirroring the pattern in
// `expenses-table.component.spec.ts`.
function flushMacrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

const TEST_SHEET: Sheet = { id: 1, title: 'sheet_2024' };

describe('StatisticsContainer', () => {
  let component: StatisticsContainer;
  let fixture: ComponentFixture<StatisticsContainer>;
  let viewTransitionSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, StatisticsContainer, StoreModule.forRoot(reducers, { metaReducers })]
    }).compileComponents();

    // The container's constructor synchronously reads `sheetsSelector`/`currentSheetSelector` and
    // indexes into `sheets` (`formChanged`, `statistics.container.ts:64,83`); an empty/unselected
    // store throws there. Seed a valid current sheet before any `StatisticsContainer` is created
    // (including the extra instances the tests below construct directly) so that path is
    // deterministic and independent of whatever the real browser's localStorage happens to hold.
    const store = TestBed.inject(Store);
    store.dispatch(AppActions.upsertDataSheet({ dataSheet: TEST_SHEET }));
    store.dispatch(AppActions.setCurrentSheet({ sheet: TEST_SHEET }));

    // `expenses$` (`statistics.container.ts:40-43`) calls `document.startViewTransition` on every
    // change detection. The real View Transitions API allows only one active transition per
    // document; the tests below that construct a second `StatisticsContainer` in the same test
    // would otherwise make the browser abort the first transition, surfacing as an unhandled
    // `AbortError` unrelated to anything under test here. Replace it with a synchronous stand-in.
    viewTransitionSpy = vi.spyOn(document, 'startViewTransition').mockImplementation((callbackOptions) => {
      if (typeof callbackOptions === 'function') {
        callbackOptions();
      }
      const done = Promise.resolve();
      return {
        ready: done,
        finished: done,
        updateCallbackDone: done,
        skipTransition: () => undefined,
        types: new Set()
      };
    });

    fixture = TestBed.createComponent(StatisticsContainer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    viewTransitionSpy.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // [AC15] `tableAnimation()` still adds/removes the right CSS classes on the summary table
  // element for each direction, reading the migrated optional `summaryTable` viewChild.
  describe('tableAnimation() class toggling', () => {
    function summaryTableClasses(): DOMTokenList {
      return (fixture.debugElement.query(By.css('expenses-table')).nativeElement as HTMLElement).classList;
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
        toJSON: () => ({})
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
