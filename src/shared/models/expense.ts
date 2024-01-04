export interface Expense {
  date: Date;
  userId: string;
  amount?: number;
  category?: string;
  comment?: string;
}
