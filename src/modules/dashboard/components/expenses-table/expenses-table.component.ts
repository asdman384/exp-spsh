import { CdkDrag, CdkDragEnd, CdkDragMove, CdkDragStart } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { DATE_FORMAT, DATE_TIME_FORMAT } from 'src/constants';
import { Expense } from 'src/shared/models';

const DEFAULT_COLS: Array<keyof Expense> = ['date', 'category', 'amount', 'comment'];
const DELETE_THRESHOLD = 100;

@Component({
  selector: 'expenses-table',
  templateUrl: './expenses-table.component.html',
  styleUrl: './expenses-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpensesTableComponent implements OnChanges {
  protected readonly dateFormat = DATE_FORMAT;
  protected readonly dateTimeFormat = DATE_TIME_FORMAT;
  protected columns = DEFAULT_COLS;
  protected dragPlaceholderY: number = 0;
  protected dragging: boolean = false;
  protected isDelete: boolean = false;
  protected lastDeletedDragRow?: CdkDrag<Expense>;

  @Input()
  showDateCol: boolean = true;

  @Input()
  dataSource: ReadonlyArray<Expense> = [];

  @Input()
  dragDisabled: boolean = true;

  @Output()
  readonly onDeleteRow = new EventEmitter<Expense>();

  @Output()
  readonly onCellClick = new EventEmitter<{ field: keyof Expense; cellData: unknown; rowData: Expense }>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dataSource'].currentValue) {
      const exps = changes['dataSource'].currentValue as ReadonlyArray<Expense>;
      if (!exps[0]) {
        return;
      }
      this.columns = DEFAULT_COLS.filter((field) => this.hasData(exps, field) && !this.isColHidden(field));
      if (this.lastDeletedDragRow?._dragRef['_rootElement']) {
        this.lastDeletedDragRow.reset();
      }
    }
  }

  protected cellClickHandler(field: keyof Expense, cellData: unknown, rowData: Expense): void {
    this.onCellClick.emit({ field, cellData, rowData });
  }

  protected cdkDragMoved(event: CdkDragMove<Expense>): void {
    this.isDelete = event.distance.x > DELETE_THRESHOLD;
  }

  protected cdkDragStarted(event: CdkDragStart): void {
    this.dragPlaceholderY = event.source.element.nativeElement.offsetTop;
    this.dragging = true;
  }

  protected cdkDragEnded(event: CdkDragEnd<Expense>): void {
    setTimeout(() => (this.dragging = false), 250);
    this.isDelete = false;

    if (event.distance.x > DELETE_THRESHOLD) {
      this.lastDeletedDragRow = event.source;
      event.source.setFreeDragPosition({ x: window.outerWidth, y: 0 });
      this.onDeleteRow.emit(event.source.data);
    }
  }

  protected truncate(value: string | undefined): string {
    if (value === undefined || value === null) {
      return '';
    }

    const result = value.split(/[ \n]/g).splice(0, 5);
    if (result.length === 5) {
      result[4] = result[4].substring(0, result[4].length - 3) + '...';
    }

    return result.join(' ');
  }

  private isColHidden(field: keyof Expense): boolean {
    return field === 'date' && !this.showDateCol;
  }

  private hasData(exps: ReadonlyArray<Expense>, field: keyof Expense): boolean {
    return exps.some((e) => e[field] !== undefined);
  }
}
