import { parseAmount } from './parse-amount';

describe('parseAmount', () => {
  it.each([
    ['4,40', 4.4],
    ['4.40', 4.4],
    ['12+7.5', 19.5],
    [' 12 + 7,5 ', 19.5],
    ['0.1+0.2', 0.3],
    ['1+2+3', 6],
    ['0', 0],
    ['-4,4', -4.4],
    [',5+.5', 1],
  ])('parses %s as %s', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it.each(['', ' ', '+', '12+', '1++2', '4,4.0', '1,000,000', '2*3', '1/2', '1e3', 'NaN', 'Infinity', 'alert(1)', '9'.repeat(400)])(
    'rejects %s',
    text => expect(parseAmount(text)).toBeNull(),
  );
});
