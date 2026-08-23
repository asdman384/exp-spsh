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

  it('[AC5] should return false when isInDebt is true vs false', () => {
    const date = new Date('2023-01-01');
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date, isInDebt: true };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date, isInDebt: false };

    expect(isExpenseEqual(expense1, expense2)).toBeFalsy();
  });

  it('[AC5] should return false when isInDebt is true vs undefined (field omitted)', () => {
    const date = new Date('2023-01-01');
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date, isInDebt: true };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date };

    expect(isExpenseEqual(expense1, expense2)).toBeFalsy();
  });

  it('[AC5] should return true when isInDebt is undefined (field omitted) vs false (treated as equal)', () => {
    const date = new Date('2023-01-01');
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date, isInDebt: false };

    expect(isExpenseEqual(expense1, expense2)).toBeTruthy();
  });

  it('[AC5] should return true for a loaded expense with blank column E (isInDebt: false) vs an app-constructed expense that omits the field (isInDebt: undefined) — Stage 2 read-back pairing', () => {
    const date = new Date('2023-01-01');
    // Simulates loadLastExpenses()/loadExpenses() output for a row whose column E was blank:
    // both load paths coerce this to isInDebt: false (never undefined).
    const loadedExpense: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date, isInDebt: false };
    // Simulates an app-constructed Expense (e.g. dashboard form before the checkbox is touched)
    // that simply omits the field.
    const formExpense: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date };

    expect(isExpenseEqual(loadedExpense, formExpense)).toBeTruthy();
    expect(isExpenseEqual(formExpense, loadedExpense)).toBeTruthy();
  });

  it('[AC5] should return true when isInDebt is true vs true', () => {
    const date = new Date('2023-01-01');
    const expense1: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date, isInDebt: true };
    const expense2: Expense = { comment: 'Test expense', category: 'Food', amount: 50, date: date, isInDebt: true };

    expect(isExpenseEqual(expense1, expense2)).toBeTruthy();
  });
});
