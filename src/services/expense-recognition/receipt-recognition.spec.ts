import { parseReceiptResponse, RECEIPT_ERRORS } from './receipt-recognition';

describe('receipt recognition boundary', () => {
  const categories = ['Food', 'Home'];
  const fallback = new Date(2026, 10, 7, 18, 30, 12, 123);
  const row = { category: 'Food', amount: 12.5, comment: '  milk, bread  ' };
  const parse = (value: unknown) => parseReceiptResponse(value, categories, fallback);

  it('maps grouped amounts and a receipt date without retaining response fields', () => {
    const result = parse({ date: '2024-02-29', expenses: [row, { category: 'Home', amount: 5, comment: 'soap' }] });
    expect(result).toEqual([
      { category: 'Food', amount: 12.5, comment: 'milk, bread', date: new Date(2024, 1, 29, 18, 30, 12, 123) },
      { category: 'Home', amount: 5, comment: 'soap', date: new Date(2024, 1, 29, 18, 30, 12, 123) },
    ]);
    expect(result[0].date).not.toBe(result[1].date);
    expect(fallback).toEqual(new Date(2026, 10, 7, 18, 30, 12, 123));
  });

  it('copies the selected Dashboard date when the receipt has no date', () => {
    const [result] = parse({ date: null, expenses: [row] });
    expect(result.date).toEqual(fallback);
    expect(result.date).not.toBe(fallback);
  });

  it.each([
    undefined,
    null,
    [],
    'secret response',
    5,
    {},
    { date: null },
    { expenses: [row] },
    { date: null, expenses: [] },
    { date: null, expenses: {} },
    { date: null, expenses: [row], extra: 'secret' },
  ])('rejects malformed root %j with a fixed error', value => {
    expect(() => parse(value)).toThrow(RECEIPT_ERRORS.recognition);
  });

  it.each([
    undefined,
    null,
    [],
    'secret row',
    {},
    { ...row, amount: '12.5' },
    { ...row, amount: 0 },
    { ...row, amount: -1 },
    { ...row, amount: NaN },
    { ...row, amount: Infinity },
    { ...row, category: 'Unknown' },
    { ...row, comment: null },
    { ...row, extra: true },
  ])('rejects the entire batch when one row is invalid: %j', value => {
    expect(() => parse({ date: null, expenses: [{ category: 'Home', amount: 1, comment: '' }, value] })).toThrow(
      RECEIPT_ERRORS.recognition,
    );
  });

  it('rejects duplicate category totals', () => {
    expect(() => parse({ date: null, expenses: [row, row] })).toThrow(RECEIPT_ERRORS.recognition);
  });

  it.each([
    '2023-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-11-00',
    '26-11-07',
    '2026-1-7',
    '2026-11-07T00:00:00Z',
    '',
    7,
    {},
  ])('rejects invalid or ambiguous receipt date %j', date => {
    expect(() => parse({ date, expenses: [row] })).toThrow(RECEIPT_ERRORS.recognition);
  });
});
