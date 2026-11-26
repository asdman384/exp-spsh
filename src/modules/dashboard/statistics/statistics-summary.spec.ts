import { summarizeMonth } from './statistics-summary';

describe('summarizeMonth', () => {
  it('does not change any statistic when only debt flags change', () => {
    const current = [
      { category: 'Food', amount: 70 },
      { category: 'Travel', amount: 30 },
    ];
    const previous = [
      { category: 'Food', amount: 40 },
      { category: 'Rent', amount: 20 },
    ];
    const flagged = (rows: typeof current) => rows.map(row => ({ ...row, isInDebt: true }));
    const expected = summarizeMonth(current, previous);
    expect(summarizeMonth(flagged(current), previous)).toEqual(expected);
    expect(summarizeMonth(current, flagged(previous))).toEqual(expected);
    expect(summarizeMonth(flagged(current), flagged(previous))).toEqual(expected);
  });

  it('ranks spending, shows shares and compares the same category across months', () => {
    const result = summarizeMonth(
      [
        { category: 'Travel', amount: 30 },
        { category: 'Food', amount: 50 },
        { category: 'Food', amount: 20 },
        { category: 'Loan', amount: 300, isInDebt: true },
      ],
      [
        { category: 'Food', amount: 40 },
        { category: 'Rent', amount: 10 },
      ],
    );
    expect(result.spending).toEqual([
      { category: 'Loan', amount: 300, share: 75, delta: 300, previousOnly: false },
      { category: 'Food', amount: 70, share: 17.5, delta: 30, previousOnly: false },
      { category: 'Travel', amount: 30, share: 7.5, delta: 30, previousOnly: false },
      { category: 'Rent', amount: 0, share: 0, delta: -10, previousOnly: true },
    ]);
  });

  it('includes every row regardless of the debt flag', () => {
    const result = summarizeMonth(
      [
        { category: 'Food', amount: 5 },
        { category: 'Food', amount: -8, isInDebt: true },
      ],
      [{ category: 'Food', amount: 10, isInDebt: true }],
    );
    expect(result.spending[0]).toEqual({ category: 'Food', amount: -3, share: 100, delta: -13, previousOnly: false });
  });

  it('handles empty months, zero totals, missing categories and special object keys', () => {
    expect(summarizeMonth([], [])).toEqual({ spending: [] });
    expect(summarizeMonth([{ amount: 0 }, { category: '__proto__', amount: 0 }], []).spending).toEqual([
      { category: '__proto__', amount: 0, share: 0, delta: 0, previousOnly: false },
      { category: 'Uncategorized', amount: 0, share: 0, delta: 0, previousOnly: false },
    ]);
  });

  it('distinguishes a missing category from a saved zero and offsetting entries', () => {
    const { spending } = summarizeMonth(
      [
        { category: 'Saved zero', amount: 0 },
        { category: 'Refunded', amount: 12 },
        { category: 'Refunded', amount: -12 },
      ],
      [{ category: 'Медикаменти', amount: 56 }],
    );
    expect(spending).toHaveLength(3);
    expect(spending).toEqual(
      expect.arrayContaining([
        { category: 'Медикаменти', amount: 0, share: 0, delta: -56, previousOnly: true },
        { category: 'Saved zero', amount: 0, share: 0, delta: 0, previousOnly: false },
        { category: 'Refunded', amount: 0, share: 0, delta: 0, previousOnly: false },
      ]),
    );
  });

  it('uses the full selected month for the category share and the full previous month for the change', () => {
    const { spending } = summarizeMonth(
      [
        { category: 'Ресторан', amount: 460.1 },
        { category: 'Other', amount: 3002.53 },
      ],
      [{ category: 'Ресторан', amount: 1026.2 }],
    );
    const total = spending.reduce((sum, row) => sum + row.amount, 0);
    expect(total).toBeCloseTo(3462.63, 2);
    const restaurant = spending[1];
    expect(restaurant.category).toBe('Ресторан');
    expect(restaurant.amount).toBe(460.1);
    expect(restaurant.share).toBeCloseTo(13.3, 1);
    expect(restaurant.delta).toBeCloseTo(-566.1, 2);
  });
});
