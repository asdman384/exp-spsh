import { Expense, ExpenseTableRow } from 'src/shared/models';

export function summarizeMonth(
  current: readonly Expense[],
  previous: readonly Expense[],
): {
  spending: ExpenseTableRow[];
} {
  const spending = compareCategories(current, previous);
  const total = spending.reduce((sum, row) => sum + row.amount, 0);
  return {
    spending: spending.map(row => ({ ...row, share: total === 0 ? 0 : (row.amount / total) * 100 })),
  };
}

export function categoryName(expense: Expense): string {
  return expense.category || 'Uncategorized';
}

function totals(rows: readonly Expense[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    const name = categoryName(row);
    result.set(name, (result.get(name) ?? 0) + Number(row.amount ?? 0));
  }
  return result;
}

function compareCategories(current: readonly Expense[], previous: readonly Expense[]) {
  const now = totals(current);
  const before = totals(previous);
  return [...new Set([...now.keys(), ...before.keys()])]
    .map(category => ({
      category,
      amount: now.get(category) ?? 0,
      delta: (now.get(category) ?? 0) - (before.get(category) ?? 0),
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}
