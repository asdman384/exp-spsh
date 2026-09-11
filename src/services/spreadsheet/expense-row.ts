/// <reference types="gapi" />
/// <reference types="gapi.client.sheets-v4" />

import { Expense } from 'src/shared/models';

/**
 * The `data_<name>` sheet's column order, authored exactly once. Column letters, 0-based
 * indices, the column count, and the gviz column-list fragment are all derived below --
 * inserting a column is a one-line edit to this list.
 */
const EXPENSE_COLUMNS = ['category', 'comment', 'amount', 'date', 'isInDebt'] as const satisfies ReadonlyArray<
  keyof Expense
>;

type ExpenseColumn = (typeof EXPENSE_COLUMNS)[number];

export const EXPENSE_COLUMN_COUNT = EXPENSE_COLUMNS.length;

/**
 * `A + index`. Correct for the columns that exist today and for any realistic growth, but
 * this breaks silently past column Z -- not worth an AA-column algorithm nobody needs yet.
 */
const EXPENSE_COLUMN_LETTERS = EXPENSE_COLUMNS.reduce(
  (letters, column, index) => ({ ...letters, [column]: String.fromCharCode(65 + index) }),
  {} as Record<ExpenseColumn, string>
);

const EXPENSE_COLUMN_INDEXES = EXPENSE_COLUMNS.reduce(
  (indexes, column, index) => ({ ...indexes, [column]: index }),
  {} as Record<ExpenseColumn, number>
);

export const EXPENSE_COLUMN_INDEX: Readonly<Record<ExpenseColumn, number>> = EXPENSE_COLUMN_INDEXES;

/** e.g. `A, B, C, D, E` -- for the gviz `select` clause. */
export const EXPENSE_GVIZ_COLUMNS = EXPENSE_COLUMNS.map((column) => EXPENSE_COLUMN_LETTERS[column]).join(', ');

/** The gviz `where` clause filters on this column's letter. */
export const EXPENSE_DATE_COLUMN_LETTER = EXPENSE_COLUMN_LETTERS.date;

/**
 * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/get
 * Builds the `<sheetName>!A1:E<take>` range for `loadLastExpenses` from the first and last
 * columns in {@link EXPENSE_COLUMNS}.
 */
export function expenseValuesRange(sheetName: string, take: number): string {
  const first = EXPENSE_COLUMN_LETTERS[EXPENSE_COLUMNS[0]];
  const last = EXPENSE_COLUMN_LETTERS[EXPENSE_COLUMNS[EXPENSE_COLUMNS.length - 1]];
  return `${sheetName}!${first}1:${last}${take}`;
}

type ExpenseCellWriter = (expense: Expense) => gapi.client.sheets.CellData;

const EXPENSE_CELL_WRITERS: Record<ExpenseColumn, ExpenseCellWriter> = {
  category: (expense) => ({ userEnteredValue: { stringValue: expense.category } }),
  comment: (expense) => ({ userEnteredValue: { stringValue: expense.comment } }),
  amount: (expense) => ({ userEnteredValue: { numberValue: expense.amount } }),
  date: (expense) => ({ userEnteredValue: { numberValue: getSerialNumberFromDate(expense.date!) } }),
  isInDebt: (expense) => ({ userEnteredValue: expense.isInDebt ? { numberValue: expense.amount } : undefined })
};

/**
 * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#updatecellsrequest
 * `Expense` -> the 5 `CellData` entries `addExpense` writes, in {@link EXPENSE_COLUMNS} order.
 */
export function toExpenseCells(expense: Expense): Array<gapi.client.sheets.CellData> {
  return EXPENSE_COLUMNS.map((column) => EXPENSE_CELL_WRITERS[column](expense));
}

/**
 * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/get
 * Parses one row of `loadLastExpenses`'s `values.get` response. Preserves that path's current
 * behaviour: `category` and `amount` pass through raw, and the date is decoded with no guard
 * against a missing cell.
 */
export function fromExpenseValueRow(row: ReadonlyArray<unknown>): Expense {
  const category = row[EXPENSE_COLUMN_INDEX.category] as Expense['category'];
  const comment = row[EXPENSE_COLUMN_INDEX.comment] as Expense['comment'];
  const amount = row[EXPENSE_COLUMN_INDEX.amount] as Expense['amount'];
  const date = row[EXPENSE_COLUMN_INDEX.date] as number;
  const isInDebt = row[EXPENSE_COLUMN_INDEX.isInDebt];

  return {
    category,
    comment: comment ? String(comment) : undefined,
    amount,
    date: getDateFromSerialNumber(date),
    isInDebt: isInDebt !== undefined && isInDebt !== null
  };
}

/** One gviz response cell. Shape unchanged -- deliberately does not gain `| null`, see spec D5. */
export interface GvizCell {
  v: string | number;
  f?: string;
}

/**
 * https://developers.google.com/chart/interactive/docs/spreadsheets#example:-using-oauth-to-access-gviztq
 * Parses one row's cells from `loadExpenses`'s gviz response. Preserves that path's current
 * behaviour: `category`/`amount` are coerced with `?? ''` / `?? 0`, and the date is guarded
 * before being parsed.
 */
export function fromExpenseGvizRow(cells: ReadonlyArray<GvizCell>): Expense {
  const comment = cells[EXPENSE_COLUMN_INDEX.comment]?.v;
  const date = cells[EXPENSE_COLUMN_INDEX.date]?.v;
  const isInDebt = cells[EXPENSE_COLUMN_INDEX.isInDebt]?.v;

  return {
    category: String(cells[EXPENSE_COLUMN_INDEX.category]?.v ?? ''),
    comment: comment ? String(comment) : undefined,
    amount: Number(cells[EXPENSE_COLUMN_INDEX.amount]?.v ?? 0),
    date: date !== undefined && date !== null ? secureParseDate(date as string) : undefined,
    isInDebt: isInDebt !== undefined && isInDebt !== null
  };
}

/**
 * https://developers.google.com/sheets/api/reference/rest/v4/DateTimeRenderOption
 * Instructs date, time, datetime, and duration fields to be output as doubles in "serial number" format, as popularized by Lotus 1-2-3.
 * The whole number portion of the value (left of the decimal) counts the days since December 30th 1899.
 * The fractional portion (right of the decimal) counts the time as a fraction of the day.
 * For example, January 1st 1900 at noon would be 2.5, 2 because it's 2 days after December 30th 1899, and .5 because noon is half a day.
 * February 1st 1900 at 3pm would be 33.625. This correctly treats the year 1900 as not a leap year.
 * @param date
 * @returns SERIAL_NUMBER
 */
function getSerialNumberFromDate(date: Date): number {
  return 25569.0 + (date.getTime() - date.getTimezoneOffset() * 60 * 1000) / (1000 * 60 * 60 * 24);
}

function getDateFromSerialNumber(date: number): Date {
  const utcTime = (date + 0.0000000001 - 25569.0) * 1000 * 60 * 60 * 24;
  // Offset must come from the target instant, not "now" -- DST rules differ across the year,
  // so a fixed "now" offset shifts historical dates near a DST boundary by an hour.
  const offsetMinutes = new Date(utcTime).getTimezoneOffset();
  return new Date(utcTime + offsetMinutes * 60 * 1000);
}

/**
 * @param value string date representation example: Date(2024,0,16,12,14,23)
 */
function secureParseDate(value: string): Date {
  const regex = /^Date\((\d{4}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2})\)$/;
  const match = regex.exec(value);
  if (match) {
    const [, year, month, day, hours, minutes, seconds] = match;
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10),
      parseInt(day, 10),
      parseInt(hours, 10),
      parseInt(minutes, 10),
      parseInt(seconds, 10)
    );
  }

  throw Error('should provide a valid date');
}
