import { Component, Input } from '@angular/core';
import { Expense } from 'src/shared/models';

@Component({
  selector: 'expenses-table',
  templateUrl: './expenses-table.component.html',
  styleUrl: './expenses-table.component.scss'
})
export class ExpensesTableComponent {
  @Input()
  dataSource: ReadonlyArray<Expense> = [];
}
