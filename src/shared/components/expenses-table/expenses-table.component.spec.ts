import { CdkDragEnd } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCheckbox } from '@angular/material/checkbox';
import { By } from '@angular/platform-browser';
import { Expense } from 'src/shared/models';

import { ExpensesTableComponent } from './expenses-table.component';

// `fakeAsync`/`tick` require zone.js's ProxyZone, which is wired up via the Jasmine test-runner
// shim in `zone.js/testing`. This project's Angular Vitest runner does not go through Jasmine,
// so `fakeAsync` throws "Expected to be running in 'ProxyZone', but it was not found." here.
// A plain macrotask flush (a zero-delay `setTimeout`) is used instead to wait out
// `EventEmitter`'s async (`isAsync: true`) delivery, which itself is implemented with a real
// `setTimeout(fn)` (see `@angular/core`'s `EventEmitter_.wrapInTimeout`).
function flushMacrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

function fullRow(overrides: Partial<Expense> = {}): Expense {
  return {
    date: new Date('2024-01-01'),
    amount: 10,
    category: 'Food',
    comment: 'lunch',
    isInDebt: false,
    ...overrides
  };
}

function aggregateRow(overrides: Partial<Expense> = {}): Expense {
  return {
    category: 'Food',
    amount: 42,
    ...overrides
  };
}

/** Column keys currently rendered as `<th>` cells, in DOM order, derived from the
 * `mat-column-<name>` class Angular Material's CDK table applies to every header cell. */
function renderedHeaderColumns(fixture: ComponentFixture<ExpensesTableComponent>): string[] {
  return fixture.debugElement
    .queryAll(By.css('th'))
    .map((de) => Array.from(de.nativeElement.classList as DOMTokenList).find((c: string) => c.startsWith('mat-column-')))
    .filter((c): c is string => !!c)
    .map((c) => c.replace('mat-column-', ''));
}

function isDragDisabledOnFirstRow(fixture: ComponentFixture<ExpensesTableComponent>): boolean {
  const rowDe = fixture.debugElement.query(By.css('tr[mat-row]'));
  return (rowDe.nativeElement as HTMLElement).classList.contains('cdk-drag-disabled');
}

function bodyRowCheckboxes(fixture: ComponentFixture<ExpensesTableComponent>): MatCheckbox[] {
  return fixture.debugElement.queryAll(By.css('td.mat-column-select mat-checkbox')).map((de) => de.componentInstance as MatCheckbox);
}

describe('ExpensesTableComponent', () => {
  let component: ExpensesTableComponent;
  let fixture: ComponentFixture<ExpensesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesTableComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // [AC7 / showDateCol input]
  describe('showDateCol input', () => {
    it('should_render_date_column_when_showDateCol_is_true', () => {
      fixture.componentRef.setInput('dataSource', [fullRow()]);
      fixture.detectChanges();

      expect(renderedHeaderColumns(fixture)).toContain('date');
    });

    it('should_hide_date_column_when_showDateCol_is_false', () => {
      // Flags must be set before `dataSource` so the current implementation's
      // dataSource-gated `defineCols()` reads the updated value in the same recompute.
      fixture.componentRef.setInput('showDateCol', false);
      fixture.componentRef.setInput('dataSource', [fullRow()]);
      fixture.detectChanges();

      expect(renderedHeaderColumns(fixture)).not.toContain('date');
    });
  });

  // [AC7 / dataSource input]
  describe('dataSource input', () => {
    it('should_render_only_columns_with_data_for_aggregate_rows', () => {
      fixture.componentRef.setInput('dataSource', [aggregateRow()]);
      fixture.detectChanges();

      expect(renderedHeaderColumns(fixture)).toEqual(['category', 'amount']);
    });

    it('should_render_all_default_columns_for_full_rows', () => {
      fixture.componentRef.setInput('dataSource', [fullRow()]);
      fixture.detectChanges();

      expect(renderedHeaderColumns(fixture)).toEqual(['date', 'category', 'amount', 'comment', 'isInDebt']);
    });

    it('should_render_one_body_row_per_dataSource_entry_with_matching_cell_content', () => {
      const rows = [fullRow({ category: 'Rent' }), fullRow({ category: 'Groceries' })];
      fixture.componentRef.setInput('dataSource', rows);
      fixture.detectChanges();

      const rowEls = fixture.debugElement.queryAll(By.css('tr[mat-row]'));
      expect(rowEls.length).toBe(2);

      const categoryCells = fixture.debugElement.queryAll(By.css('td.mat-column-category'));
      expect(categoryCells.map((de) => (de.nativeElement as HTMLElement).textContent?.trim())).toEqual(['Rent', 'Groceries']);
    });

    it('should_render_no_body_rows_when_dataSource_is_empty', () => {
      expect(fixture.debugElement.queryAll(By.css('tr[mat-row]')).length).toBe(0);
    });
  });

  // [AC7 / draggable input]
  describe('draggable input', () => {
    it('should_disable_drag_by_default', () => {
      fixture.componentRef.setInput('dataSource', [fullRow()]);
      fixture.detectChanges();

      expect(isDragDisabledOnFirstRow(fixture)).toBe(true);
    });

    it('should_enable_drag_when_draggable_is_true', () => {
      fixture.componentRef.setInput('draggable', true);
      fixture.componentRef.setInput('dataSource', [fullRow()]);
      fixture.detectChanges();

      expect(isDragDisabledOnFirstRow(fixture)).toBe(false);
    });
  });

  // [AC7 / selectable input]
  describe('selectable input', () => {
    it('should_hide_select_column_by_default', () => {
      fixture.componentRef.setInput('dataSource', [fullRow()]);
      fixture.detectChanges();

      expect(renderedHeaderColumns(fixture)).not.toContain('select');
    });

    it('should_show_select_column_when_selectable_is_true', () => {
      fixture.componentRef.setInput('selectable', true);
      fixture.componentRef.setInput('dataSource', [fullRow()]);
      fixture.detectChanges();

      expect(renderedHeaderColumns(fixture)[0]).toBe('select');
    });
  });

  // [AC7 / selected input]
  describe('selected input', () => {
    it('should_mark_provided_rows_as_selected_in_rendered_checkboxes', () => {
      const rows = [fullRow({ category: 'Rent' }), fullRow({ category: 'Groceries' })];
      fixture.componentRef.setInput('selectable', true);
      fixture.componentRef.setInput('dataSource', rows);
      fixture.componentRef.setInput('selected', [rows[0]]);
      fixture.detectChanges();

      const checkboxes = bodyRowCheckboxes(fixture);
      expect(checkboxes.length).toBe(2);
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(false);
    });

    it('should_unmark_all_checkboxes_when_selected_is_empty', () => {
      const rows = [fullRow({ category: 'Rent' }), fullRow({ category: 'Groceries' })];
      fixture.componentRef.setInput('selectable', true);
      fixture.componentRef.setInput('dataSource', rows);
      fixture.componentRef.setInput('selected', [rows[0]]);
      fixture.detectChanges();
      fixture.componentRef.setInput('selected', []);
      fixture.detectChanges();

      const checkboxes = bodyRowCheckboxes(fixture);
      expect(checkboxes.every((cb) => !cb.checked)).toBe(true);
    });
  });

  // [AC7 / deleteRow output]
  describe('deleteRow output', () => {
    it('should_emit_deleteRow_with_dragged_row_when_drag_exceeds_delete_threshold', () => {
      const row = fullRow();
      fixture.componentRef.setInput('dataSource', [row]);
      fixture.detectChanges();

      let deleted: Expense | undefined;
      component.deleteRow.subscribe((r) => (deleted = r));

      const rowDe = fixture.debugElement.query(By.css('tr[mat-row]'));
      const fakeDragEnd = {
        distance: { x: 150, y: 0 },
        source: { data: row, setFreeDragPosition: vi.fn(), reset: vi.fn() }
      } as unknown as CdkDragEnd<Expense>;
      rowDe.triggerEventHandler('cdkDragEnded', fakeDragEnd);

      expect(deleted).toEqual(row);
    });

    it('should_not_emit_deleteRow_when_drag_does_not_exceed_delete_threshold', () => {
      const row = fullRow();
      fixture.componentRef.setInput('dataSource', [row]);
      fixture.detectChanges();

      const deleteHandler = vi.fn();
      component.deleteRow.subscribe(deleteHandler);

      const rowDe = fixture.debugElement.query(By.css('tr[mat-row]'));
      const fakeDragEnd = {
        distance: { x: 10, y: 0 },
        source: { data: row, setFreeDragPosition: vi.fn(), reset: vi.fn() }
      } as unknown as CdkDragEnd<Expense>;
      rowDe.triggerEventHandler('cdkDragEnded', fakeDragEnd);

      expect(deleteHandler).not.toHaveBeenCalled();
    });
  });

  // [AC7 / cellClick output]
  describe('cellClick output', () => {
    it('should_emit_cellClick_payload_when_category_cell_is_clicked', () => {
      const row = fullRow({ category: 'Groceries' });
      fixture.componentRef.setInput('dataSource', [row]);
      fixture.detectChanges();

      let payload: { field: keyof Expense; cellData: unknown; rowData: Expense } | undefined;
      component.cellClick.subscribe((p) => (payload = p));

      const categoryCell = fixture.debugElement.query(By.css('td.mat-column-category'));
      categoryCell.triggerEventHandler('click', null);

      expect(payload).toEqual({ field: 'category', cellData: 'Groceries', rowData: row });
    });
  });

  // [AC7 / selectionChange output]
  describe('selectionChange output', () => {
    it('should_emit_selectionChange_with_updated_selection_after_row_toggle', async () => {
      const row = fullRow();
      fixture.componentRef.setInput('selectable', true);
      fixture.componentRef.setInput('dataSource', [row]);
      fixture.detectChanges();

      const emitted: Array<ReadonlyArray<Expense>> = [];
      component.selectionChange.subscribe((value) => emitted.push(value));

      const rowCheckbox = fixture.debugElement.query(By.css('td.mat-column-select mat-checkbox'));
      rowCheckbox.triggerEventHandler('change', null);

      expect(emitted.length).toBe(0); // delivery is deferred by one macrotask (`EventEmitter(true)`)
      await flushMacrotasks();

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual([row]);
    });
  });
});
