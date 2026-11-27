import '@angular/common/locales/global/pl';
import { SelectionModel } from '@angular/cdk/collections';
import { CdkDrag, CdkDragEnd, CdkDragMove, CdkDragStart, DragDropModule } from '@angular/cdk/drag-drop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { delay, map } from 'rxjs';
import { DATE_FORMAT, DATE_TIME_FORMAT } from 'src/constants';
import { Expense, ExpenseTableRow } from 'src/shared/models';

const DEFAULT_COLS: Array<keyof Expense> = ['date', 'category', 'amount', 'comment', 'isInDebt'];
const SUMMARY_COLS = ['category', 'amount', 'share', 'delta'] as const;
const DELETE_THRESHOLD = 100;

@Component({
  selector: 'expenses-table',
  templateUrl: './expenses-table.component.html',
  styleUrl: './expenses-table.component.scss',
  imports: [DatePipe, DecimalPipe, DragDropModule, MatCheckboxModule, MatIconModule, MatTableModule, MatTooltipModule],
})
export class ExpensesTableComponent {
  protected readonly dateFormat = DATE_FORMAT;
  protected readonly dateTimeFormat = DATE_TIME_FORMAT;
  protected readonly selection = new SelectionModel<Expense>(true, []);

  protected readonly dragPlaceholderY = signal(0);
  protected readonly dragging = signal(false);
  protected readonly isDelete = signal(false);
  protected readonly lastDeletedDragRow = signal<CdkDrag<ExpenseTableRow> | undefined>(undefined);

  readonly showDateCol = input(true);
  readonly dataSource = input<ReadonlyArray<ExpenseTableRow>>([]);
  readonly draggable = input(false);
  readonly selectable = input(false);
  readonly selected = input<ReadonlyArray<Expense>>([]);
  readonly summaryMonthLabel = input<string>();
  protected readonly summaryMode = computed(() => this.summaryMonthLabel() !== undefined);

  readonly deleteRow = output<ExpenseTableRow>();
  readonly cellClick = output<{ field: keyof Expense; cellData: unknown; rowData: Expense }>();
  readonly summarySelectionToggle = output<string | null>();
  readonly selectionChange = outputFromObservable<ReadonlyArray<Expense>>(
    this.selection.changed.pipe(
      map(() => this.selection.selected),
      delay(0),
    ),
  );

  protected readonly columns = computed(() => {
    const cols = this.summaryMode()
      ? SUMMARY_COLS
      : DEFAULT_COLS.filter(field => this.hasData(this.dataSource(), field) && !this.isColHidden(field));
    return this.selectable() ? ['select', ...cols] : cols;
  });

  protected readonly trackRow = (_index: number, row: ExpenseTableRow) => (this.summaryMode() ? row.category : row);

  constructor() {
    effect(() => {
      const value = this.selected();
      this.selection.clear();
      this.selection.select(...value);
    });

    effect(() => {
      this.dataSource();
      const row = this.lastDeletedDragRow();
      if (row?._dragRef['_rootElement']) {
        row.reset();
      }
    });
  }

  protected cellClickHandler(field: keyof Expense, cellData: unknown, rowData: Expense): void {
    if (!this.summaryMode()) this.cellClick.emit({ field, cellData, rowData });
  }

  protected cdkDragMoved(event: CdkDragMove<ExpenseTableRow>): void {
    this.isDelete.set(event.distance.x > DELETE_THRESHOLD);
  }

  protected cdkDragStarted(event: CdkDragStart<ExpenseTableRow>): void {
    this.dragPlaceholderY.set(event.source.element.nativeElement.offsetTop);
    this.dragging.set(true);
  }

  protected cdkDragEnded(event: CdkDragEnd<ExpenseTableRow>): void {
    setTimeout(() => this.dragging.set(false), 250);
    this.isDelete.set(false);

    if (event.distance.x > DELETE_THRESHOLD) {
      this.lastDeletedDragRow.set(event.source);
      event.source.setFreeDragPosition({ x: window.outerWidth, y: 0 });
      this.deleteRow.emit(event.source.data);
    } else {
      event.source.reset();
    }
  }

  protected toggleAllRows(): void {
    if (this.summaryMode()) {
      this.summarySelectionToggle.emit(null);
    } else if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource());
    }
  }

  protected toggleRow(row: Expense): void {
    if (this.summaryMode()) {
      if (row.category !== undefined) this.summarySelectionToggle.emit(row.category);
    } else {
      this.selection.toggle(row);
    }
  }

  protected isAllSelected(): boolean {
    return this.selection.selected.length === this.dataSource().length;
  }

  private isColHidden(field: keyof Expense): boolean {
    return field === 'date' && !this.showDateCol();
  }

  private hasData(exps: ReadonlyArray<Expense> | undefined, field: keyof Expense): boolean {
    if (!exps || exps.length === 0) {
      return false;
    }

    if (field === 'isInDebt') {
      return exps.some(e => e[field] === true);
    }

    return exps.some(e => e[field] !== undefined);
  }
}
