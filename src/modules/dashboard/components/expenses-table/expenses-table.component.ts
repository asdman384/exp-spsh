import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Expense } from 'src/shared/models';

const DEFAULT_COLS: Array<keyof Expense> = ['date', 'category', 'amount', 'comment'];
@Component({
  selector: 'expenses-table',
  templateUrl: './expenses-table.component.html',
  styleUrl: './expenses-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpensesTableComponent implements OnChanges {
  columns = DEFAULT_COLS;

  @Input()
  dataSource: ReadonlyArray<Expense> = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dataSource'].currentValue) {
      const exps = changes['dataSource'].currentValue as ReadonlyArray<Expense>;
      if (!exps[0]) {
        return;
      }
      this.columns = DEFAULT_COLS.filter((key) => exps.some((e) => e[key] !== undefined));
    }
  }
}
