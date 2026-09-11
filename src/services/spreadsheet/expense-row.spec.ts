import { Expense } from 'src/shared/models';

import {
  EXPENSE_COLUMN_COUNT,
  EXPENSE_COLUMN_INDEX,
  EXPENSE_DATE_COLUMN_LETTER,
  EXPENSE_GVIZ_COLUMNS,
  expenseValuesRange,
  fromExpenseGvizRow,
  fromExpenseValueRow,
  GvizCell,
  toExpenseCells
} from './expense-row';

describe('expense-row', () => {
  const baseExpense: Expense = {
    category: 'Food',
    comment: 'lunch',
    amount: 12.5,
    date: new Date(2024, 0, 16, 12, 14, 23)
  };

  // [AC1] the column order is declared exactly once, as an ordered keyof-Expense list in the
  // order category, comment, amount, date, isInDebt. The derived index lookup's own key
  // insertion order is the only runtime witness of that authored order (the keyof-Expense
  // typing itself is a compile-time guarantee, verified by tsc, not by this suite).
  describe('[AC1] column order', () => {
    it('should_declare_columns_in_category_comment_amount_date_isInDebt_order', () => {
      expect(Object.keys(EXPENSE_COLUMN_INDEX)).toEqual(['category', 'comment', 'amount', 'date', 'isInDebt']);
    });
  });

  // [AC2] letters, indices and column count are all derived from the AC1 list.
  describe('[AC2] derived letters, indices and column count', () => {
    it('should_derive_zero_based_indices_for_every_column', () => {
      expect(EXPENSE_COLUMN_INDEX).toEqual({
        category: 0,
        comment: 1,
        amount: 2,
        date: 3,
        isInDebt: 4
      });
    });

    it('should_derive_a_column_count_of_five', () => {
      expect(EXPENSE_COLUMN_COUNT).toBe(5);
    });

    it('should_derive_letter_A_for_the_first_column_and_E_for_the_last_via_expenseValuesRange', () => {
      // expenseValuesRange is the only exported surface that exposes the first/last derived
      // letters directly; EXPENSE_DATE_COLUMN_LETTER exposes the 4th (D). Together they pin
      // down category=A .. isInDebt=E without re-deriving the letters by hand here.
      expect(expenseValuesRange('Sheet1', 10)).toBe('Sheet1!A1:E10');
      expect(EXPENSE_DATE_COLUMN_LETTER).toBe('D');
    });
  });

  // [AC9] the gviz column-list fragment and date-column letter, used to compose the tq
  // template without regenerating it.
  describe('[AC9] EXPENSE_GVIZ_COLUMNS / EXPENSE_DATE_COLUMN_LETTER', () => {
    it('should_produce_the_gviz_column_list_fragment_A_through_E', () => {
      expect(EXPENSE_GVIZ_COLUMNS).toBe('A, B, C, D, E');
    });

    it('should_expose_D_as_the_date_column_letter', () => {
      expect(EXPENSE_DATE_COLUMN_LETTER).toBe('D');
    });
  });

  // [AC7] expenseValuesRange builds the loadLastExpenses range from first/last column letters.
  describe('[AC7] expenseValuesRange', () => {
    it('should_build_A1_E_take_range_string', () => {
      expect(expenseValuesRange('data_2024-01', 25)).toBe('data_2024-01!A1:E25');
    });

    it('should_reflect_a_different_take_and_sheet_name', () => {
      expect(expenseValuesRange('Sheet1', 1)).toBe('Sheet1!A1:E1');
    });
  });

  // [AC5] / [AC6] toExpenseCells: the write-path serializer.
  describe('[AC5][AC6] toExpenseCells', () => {
    it('should_emit_five_cells_in_category_comment_amount_date_isInDebt_order', () => {
      const cells = toExpenseCells({ ...baseExpense, isInDebt: true });
      expect(cells).toHaveLength(5);
    });

    it('should_write_category_and_comment_as_stringValue', () => {
      const cells = toExpenseCells(baseExpense);
      expect(cells[0]).toEqual({ userEnteredValue: { stringValue: 'Food' } });
      expect(cells[1]).toEqual({ userEnteredValue: { stringValue: 'lunch' } });
    });

    it('should_write_amount_as_numberValue', () => {
      const cells = toExpenseCells(baseExpense);
      expect(cells[2]).toEqual({ userEnteredValue: { numberValue: 12.5 } });
    });

    it('should_write_date_as_a_numeric_serial_number', () => {
      const cells = toExpenseCells(baseExpense);
      expect(cells[3].userEnteredValue?.numberValue).toEqual(expect.any(Number));
    });

    it('should_write_numberValue_expense_amount_into_the_5th_cell_when_isInDebt_is_true', () => {
      const cells = toExpenseCells({ ...baseExpense, isInDebt: true });
      expect(cells[4]).toEqual({ userEnteredValue: { numberValue: baseExpense.amount } });
    });

    it('should_write_an_absent_userEnteredValue_into_the_5th_cell_when_isInDebt_is_false', () => {
      const cells = toExpenseCells({ ...baseExpense, isInDebt: false });
      expect(cells[4].userEnteredValue).toBeUndefined();
      expect(cells[4].userEnteredValue).not.toEqual({ numberValue: 0 });
    });

    it('should_write_an_absent_userEnteredValue_into_the_5th_cell_when_isInDebt_is_undefined', () => {
      const cells = toExpenseCells({ ...baseExpense, isInDebt: undefined });
      expect(cells[4].userEnteredValue).toBeUndefined();
      expect(cells[4].userEnteredValue).not.toEqual({ numberValue: 0 });
    });
  });

  // [AC8] / [AC13] fromExpenseValueRow: the values.get row parser, and the round trip through
  // toExpenseCells for the date serial-number conversion (module-level equivalent of
  // spreadsheet.service.spec.ts's round-trip and DST regression).
  describe('[AC8] fromExpenseValueRow', () => {
    it('should_pass_category_through_raw_without_coercion', () => {
      const row = [42, 'lunch', 12.5, 45000, 12.5];
      const expense = fromExpenseValueRow(row);
      // Raw pass-through (D4): a non-string category cell is not coerced to a string, unlike
      // the gviz path.
      expect(expense.category).toBe(42);
    });

    it('should_pass_amount_through_raw_without_coercion', () => {
      const row = ['Food', 'lunch', '12.5', 45000, 12.5];
      const expense = fromExpenseValueRow(row);
      expect(expense.amount).toBe('12.5');
    });

    it('should_coerce_a_falsy_comment_to_undefined_and_a_truthy_comment_to_a_string', () => {
      expect(fromExpenseValueRow(['Food', '', 12.5, 45000]).comment).toBeUndefined();
      expect(fromExpenseValueRow(['Food', undefined, 12.5, 45000]).comment).toBeUndefined();
      expect(fromExpenseValueRow(['Food', 7, 12.5, 45000]).comment).toBe('7');
    });

    it('should_derive_isInDebt_true_when_the_5th_cell_is_present_and_false_when_absent', () => {
      expect(fromExpenseValueRow(['Food', 'lunch', 12.5, 45000, 0]).isInDebt).toBe(true);
      expect(fromExpenseValueRow(['Food', 'lunch', 12.5, 45000]).isInDebt).toBe(false);
      expect(fromExpenseValueRow(['Food', 'lunch', 12.5, 45000, null]).isInDebt).toBe(false);
    });

    it('should_call_the_unguarded_date_decoder_producing_an_Invalid_Date_when_the_4th_cell_is_missing', () => {
      // D4: no null guard on this path -- a short row must not throw, it must yield an
      // Invalid Date, exactly like spreadsheet.service.ts:279-285 did before the move.
      const expense = fromExpenseValueRow(['Food', 'lunch', 12.5]);
      expect(expense.date).toBeInstanceOf(Date);
      expect(Number.isNaN(expense.date!.getTime())).toBe(true);
    });

    it('[AC13] should_round_trip_a_local_date_through_toExpenseCells_and_fromExpenseValueRow', () => {
      const expense: Expense = { ...baseExpense, date: new Date(2024, 0, 16, 12, 14, 23) };
      const cells = toExpenseCells(expense);
      const serialNumber = cells[EXPENSE_COLUMN_INDEX.date].userEnteredValue?.numberValue;

      const row: Array<unknown> = [];
      row[EXPENSE_COLUMN_INDEX.category] = expense.category;
      row[EXPENSE_COLUMN_INDEX.comment] = expense.comment;
      row[EXPENSE_COLUMN_INDEX.amount] = expense.amount;
      row[EXPENSE_COLUMN_INDEX.date] = serialNumber;

      const decoded = fromExpenseValueRow(row).date!;
      expect(decoded.getFullYear()).toBe(2024);
      expect(decoded.getMonth()).toBe(0);
      expect(decoded.getDate()).toBe(16);
      expect(decoded.getHours()).toBe(12);
      expect(decoded.getMinutes()).toBe(14);
      expect(decoded.getSeconds()).toBe(23);
    });

    it('[AC13] should_decode_a_winter_date_correctly_when_now_is_in_a_summer_DST_offset', () => {
      // Module-level equivalent of spreadsheet.service.spec.ts's DST regression: the decoder
      // must derive its offset from the target instant, not from "now".
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 15, 8, 0, 0));

      try {
        const winterDate = new Date(2026, 0, 15, 10, 30, 0);
        const cells = toExpenseCells({ ...baseExpense, date: winterDate });
        const serialNumber = cells[EXPENSE_COLUMN_INDEX.date].userEnteredValue?.numberValue;

        const row: Array<unknown> = [];
        row[EXPENSE_COLUMN_INDEX.category] = 'Food';
        row[EXPENSE_COLUMN_INDEX.comment] = 'lunch';
        row[EXPENSE_COLUMN_INDEX.amount] = 12.5;
        row[EXPENSE_COLUMN_INDEX.date] = serialNumber;

        const decoded = fromExpenseValueRow(row).date!;
        expect(decoded.getFullYear()).toBe(2026);
        expect(decoded.getMonth()).toBe(0);
        expect(decoded.getDate()).toBe(15);
        expect(decoded.getHours()).toBe(10);
        expect(decoded.getMinutes()).toBe(30);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // [AC10] fromExpenseGvizRow: the gviz row parser.
  describe('[AC10] fromExpenseGvizRow', () => {
    it('should_coerce_category_with_String_and_default_a_missing_cell_to_empty_string', () => {
      expect(fromExpenseGvizRow([{ v: 42 }, { v: 'lunch' }, { v: 12.5 }] as ReadonlyArray<GvizCell>).category).toBe(
        '42'
      );
      expect(fromExpenseGvizRow([] as ReadonlyArray<GvizCell>).category).toBe('');
    });

    it('should_coerce_amount_with_Number_and_default_a_missing_cell_to_zero', () => {
      const cells: ReadonlyArray<GvizCell> = [{ v: 'Food' }, { v: 'lunch' }, { v: '12.5' }];
      expect(fromExpenseGvizRow(cells).amount).toBe(12.5);
      expect(fromExpenseGvizRow([{ v: 'Food' }, { v: 'lunch' }] as ReadonlyArray<GvizCell>).amount).toBe(0);
    });

    it('should_coerce_a_falsy_comment_to_undefined_and_a_truthy_comment_to_a_string', () => {
      expect(fromExpenseGvizRow([{ v: 'Food' }, { v: '' }, { v: 12.5 }] as ReadonlyArray<GvizCell>).comment).toBe(
        undefined
      );
      expect(fromExpenseGvizRow([{ v: 'Food' }] as ReadonlyArray<GvizCell>).comment).toBeUndefined();
      expect(fromExpenseGvizRow([{ v: 'Food' }, { v: 7 }, { v: 12.5 }] as ReadonlyArray<GvizCell>).comment).toBe('7');
    });

    it('should_guard_the_date_and_leave_it_undefined_when_the_4th_cell_is_absent_or_null', () => {
      expect(
        fromExpenseGvizRow([{ v: 'Food' }, { v: 'lunch' }, { v: 12.5 }] as ReadonlyArray<GvizCell>).date
      ).toBeUndefined();
      expect(
        fromExpenseGvizRow([{ v: 'Food' }, { v: 'lunch' }, { v: 12.5 }, null as unknown as GvizCell]).date
      ).toBeUndefined();
    });

    it('should_parse_a_Date_string_cell_via_secureParseDate', () => {
      const cells: ReadonlyArray<GvizCell> = [
        { v: 'Food' },
        { v: 'lunch' },
        { v: 12.5 },
        { v: 'Date(2024,0,16,12,14,23)' }
      ];
      const decoded = fromExpenseGvizRow(cells).date!;
      expect(decoded.getFullYear()).toBe(2024);
      expect(decoded.getMonth()).toBe(0);
      expect(decoded.getDate()).toBe(16);
      expect(decoded.getHours()).toBe(12);
      expect(decoded.getMinutes()).toBe(14);
      expect(decoded.getSeconds()).toBe(23);
    });

    it('should_derive_isInDebt_true_when_the_5th_cell_is_present_even_with_a_falsy_value', () => {
      // D4: isInDebt is "cell is neither undefined nor null" -- a present-but-zero cell must
      // still read as true, distinguishing it from a merely-truthy check.
      const cells: ReadonlyArray<GvizCell> = [
        { v: 'Food' },
        { v: 'lunch' },
        { v: 12.5 },
        { v: 'Date(2024,0,16,12,14,23)' },
        { v: 0 }
      ];
      expect(fromExpenseGvizRow(cells).isInDebt).toBe(true);
    });

    it('should_derive_isInDebt_false_when_the_5th_cell_is_absent_or_null', () => {
      const withoutCell: ReadonlyArray<GvizCell> = [
        { v: 'Food' },
        { v: 'lunch' },
        { v: 12.5 },
        { v: 'Date(2024,0,16,12,14,23)' }
      ];
      expect(fromExpenseGvizRow(withoutCell).isInDebt).toBe(false);

      const withNullCell = [
        { v: 'Food' },
        { v: 'lunch' },
        { v: 12.5 },
        { v: 'Date(2024,0,16,12,14,23)' },
        null as unknown as GvizCell
      ];
      expect(fromExpenseGvizRow(withNullCell).isInDebt).toBe(false);
    });
  });
});
