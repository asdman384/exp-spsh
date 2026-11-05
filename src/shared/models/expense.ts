export interface Expense {
  date?: Date;
  amount?: number;
  category?: string;
  comment?: string;
  isInDebt?: boolean;
}

export interface ExpenseTableRow extends Expense {
  // Queue entry time in milliseconds. Marks an unsent row and helps find it for discard.
  // Times can be equal, so discard also compares expense fields. Absent for saved rows.
  enqueuedAt?: number;
}
