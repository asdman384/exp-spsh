import { isExpenseEqual } from './index';
import { Expense } from '../models';

describe('isExpenseEqual', () => {
  it('should return true when expenses are equal', () => {
    const date = new Date('2023-01-01');
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date };

    expect(isExpenseEqual(expense1, expense2)).toBeTruthy();
  });

  it('should return false when comments differ', () => {
    const date = new Date('2023-01-01');
    const expense1: Expense = { comment: 'Test expense 1', category: 'Food', amount: 50, date: date };
    const expense2: Expense = { comment: 'Test expense 2', category: 'Food', amount: 50, date: date };

    expect(isExpenseEqual(expense1, expense2)).toBeFalsy();
  });

  it('should return false when dates differ', () => {
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: new Date('2023-01-01') };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: new Date('2023-01-02') };

    expect(isExpenseEqual(expense1, expense2)).toBeFalsy();
  });

  it('should return false when time differs by minutes', () => {
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: new Date('2023-01-01T10:00:00') };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: new Date('2023-01-01T10:01:00') };

    expect(isExpenseEqual(expense1, expense2)).toBeFalsy();
  });

  it('should return false when years differ', () => {
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: new Date('2023-01-01') };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: new Date('2024-01-01') };

    expect(isExpenseEqual(expense1, expense2)).toBeFalsy();
  });

  it('should handle undefined dates', () => {
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: undefined };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: undefined };

    expect(isExpenseEqual(expense1, expense2)).toBeTruthy();
  });

  it('should return false when amounts differ', () => {
    const date = new Date('2023-01-01');
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 60, date: date };

    expect(isExpenseEqual(expense1, expense2)).toBeFalsy();
  });

  it('should return false when categories differ', () => {
    const date = new Date('2023-01-01');
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date };
    const expense2: Expense = { comment: 'Test expense', category: 'Transport', amount: 50, date: date };

    expect(isExpenseEqual(expense1, expense2)).toBeFalsy();
  });
});
