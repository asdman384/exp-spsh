import { Expense } from '../models';

export function isExpenseEqual(e1: Expense, e2: Expense): boolean {
  return (
    e1.comment === e2.comment &&
    e1.category === e2.category &&
    e1.amount === e2.amount &&
    e1.date?.getSeconds() === e2.date?.getSeconds() &&
    e1.date?.getSeconds() === e2.date?.getSeconds() &&
    e1.date?.getHours() === e2.date?.getHours() &&
    e1.date?.getDate() === e2.date?.getDate() &&
    e1.date?.getMonth() === e2.date?.getMonth()
  );
}
