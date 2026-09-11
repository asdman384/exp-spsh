import { SelectionModel } from '@angular/cdk/collections';
import { CdkDrag, CdkDragEnd, CdkDragMove, CdkDragStart, DragDropModule } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DATE_FORMAT, DATE_TIME_FORMAT } from 'src/constants';
import { Expense } from 'src/shared/models';

const DEFAULT_COLS: Array<keyof Expense> = ['date', 'category', 'amount', 'comment', 'isInDebt'];
const DELETE_THRESHOLD = 100;

@Component({
    selector: 'expenses-table',
    templateUrl: './expenses-table.component.html',
    styleUrl: './expenses-table.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, DragDropModule, MatCheckboxModule, MatIconModule, MatTableModule, MatTooltipModule]
})
export class ExpensesTableComponent implements OnChanges {
  private readonly cdRef = inject(ChangeDetectorRef);

  protected readonly dateFormat = DATE_FORMAT;
  protected readonly dateTimeFormat = DATE_TIME_FORMAT;
  protected readonly selection = new SelectionModel<Expense>(true, []);

  protected columns: Array<keyof Expense | 'select'> = DEFAULT_COLS;
  protected dragPlaceholderY: number = 0;
  protected dragging: boolean = false;
  protected isDelete: boolean = false;
  protected lastDeletedDragRow?: CdkDrag<Expense>;

  @Input()
  showDateCol: boolean = true;

  @Input()
  dataSource: ReadonlyArray<Expense> = [];

  @Input()
  draggable: boolean = false;

  @Input()
  selectable: boolean = false;

  @Input()
  set selected(value: ReadonlyArray<Expense>) {
    this.selection.clear();
    this.selection.select(...value);
  }
  get selected(): ReadonlyArray<Expense> {
    return this.selection.selected;
  }

  @Output()
  readonly deleteRow = new EventEmitter<Expense>();

  @Output()
  readonly cellClick = new EventEmitter<{ field: keyof Expense; cellData: unknown; rowData: Expense }>();

  @Output()
  readonly selectionChange = new EventEmitter<ReadonlyArray<Expense>>(true);

  constructor() {
    this.selection.changed.pipe(takeUntilDestroyed()).subscribe(() => this.selectionChange.emit(this.selection.selected));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dataSource']?.currentValue) {
      const exps = changes['dataSource'].currentValue as ReadonlyArray<Expense>;
      this.defineCols(exps);
      if (this.lastDeletedDragRow?._dragRef['_rootElement']) {
        this.lastDeletedDragRow.reset();
      }
    }
  }

  protected cellClickHandler(field: keyof Expense, cellData: unknown, rowData: Expense): void {
    this.cellClick.emit({ field, cellData, rowData });
  }

  protected cdkDragMoved(event: CdkDragMove<Expense>): void {
    this.isDelete = event.distance.x > DELETE_THRESHOLD;
  }

  protected cdkDragStarted(event: CdkDragStart<Expense>): void {
    this.dragPlaceholderY = event.source.element.nativeElement.offsetTop;
    this.dragging = true;
  }

  protected cdkDragEnded(event: CdkDragEnd<Expense>): void {
    setTimeout(() => (this.dragging = false), 250);
    this.isDelete = false;

    if (event.distance.x > DELETE_THRESHOLD) {
      this.lastDeletedDragRow = event.source;
      event.source.setFreeDragPosition({ x: window.outerWidth, y: 0 });
      this.deleteRow.emit(event.source.data);
    } else {
      event.source.reset();
    }
  }

  protected toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource);
    }
    this.cdRef.detectChanges();
  }

  protected toggleRow(row: Expense): void {
    this.selection.toggle(row);
    this.cdRef.detectChanges();
  }

  protected isAllSelected(): boolean {
    return this.selection.selected.length === this.dataSource.length;
  }

  private defineCols(exps?: ReadonlyArray<Expense>): void {
    const cols: ExpensesTableComponent['columns'] = [];
    if (this.selectable) {
      cols.push('select');
    }
    cols.push(...DEFAULT_COLS.filter((field) => this.hasData(exps, field) && !this.isColHidden(field)));
    this.columns = cols;
  }

  private isColHidden(field: keyof Expense): boolean {
    return field === 'date' && !this.showDateCol;
  }

  private hasData(exps: ReadonlyArray<Expense> | undefined, field: keyof Expense): boolean {
    if (!exps || exps.length === 0) {
      return false;
    }
    return exps.some((e) => e[field] !== undefined);
  }
}
