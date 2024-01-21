import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  numberAttribute
} from '@angular/core';
import { DATE_FORMAT, DATE_TIME_FORMAT } from 'src/constants';
import { Expense } from 'src/shared/models';

const DEFAULT_COLS: Array<keyof Expense> = ['date', 'category', 'amount', 'comment'];
@Component({
  selector: 'expenses-table',
  templateUrl: './expenses-table.component.html',
  styleUrl: './expenses-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpensesTableComponent implements OnChanges {
  readonly dateFormat = DATE_FORMAT;
  readonly dateTimeFormat = DATE_TIME_FORMAT;
  columns = DEFAULT_COLS;
  @Input()
  showDateCol: boolean = true;

  @Input()
  dataSource: ReadonlyArray<Expense> = [];

  @Output()
  readonly onCellClick = new EventEmitter<{ field: keyof Expense; cellData: unknown; rowData: Expense }>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dataSource'].currentValue) {
      const exps = changes['dataSource'].currentValue as ReadonlyArray<Expense>;
      if (!exps[0]) {
        return;
      }
      this.columns = DEFAULT_COLS.filter((field) => this.hasData(exps, field) && !this.isColHidden(field));
    }
  }

  private isColHidden(field: keyof Expense): boolean {
    return field === 'date' && !this.showDateCol;
  }

  private hasData(exps: ReadonlyArray<Expense>, field: keyof Expense): boolean {
    return exps.some((e) => e[field] !== undefined);
  }

  cellClickHandler(field: keyof Expense, cellData: unknown, rowData: Expense): void {
    this.onCellClick.emit({ field, cellData, rowData });
  }

  truncate(value: string | undefined): string {
    if (value === undefined || value === null) {
      return '';
    }

    const result = value.split(/[ \n]/g).splice(0, 5);
    if (result.length === 5) {
      result[4] = result[4].substring(0, result[4].length - 3) + '...';
    }

    return result.join(' ');
  }
}
