import { DestroyRef, Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Subject, Subscription } from 'rxjs';
import { categoriesSelector, loadingSelector, spreadsheetIdSelector } from 'src/@state';
import { ExpenseRecognitionService } from 'src/services';
import {
  ReceiptExpense,
  RECEIPT_ERRORS,
  validateReceiptInput,
  isValidReceiptDraftRow,
} from 'src/services/expense-recognition/receipt-recognition';
import { Sheet } from 'src/shared/models';

interface ReceiptScope {
  spreadsheetId: string;
  sheetId: number;
  categories: string[];
}

type ReceiptState =
  { kind: 'idle' } | { kind: 'recognizing'; scope: ReceiptScope } | { kind: 'review'; scope: ReceiptScope; expenses: ReceiptExpense[] };

/** Owns the transient receipt draft. Only confirmed batches leave this service. */
@Injectable({ providedIn: 'root' })
export class ReceiptReaderService {
  private readonly store = inject(Store);
  private readonly recognition = inject(ExpenseRecognitionService);
  private readonly spreadsheetId = this.store.selectSignal(spreadsheetIdSelector);
  private readonly categories = toSignal(this.store.select(categoriesSelector), { initialValue: [] });
  private readonly loading = toSignal(this.store.select(loadingSelector), { initialValue: false });
  private readonly context = signal<{ date: Signal<Date>; sheet: Signal<Sheet | null> } | null>(null);
  private receiptSubscription?: Subscription;
  private readonly state = signal<ReceiptState>({ kind: 'idle' });
  readonly receiptState = this.state.asReadonly();
  private readonly error = signal('');
  readonly receiptError = this.error.asReadonly();
  private readonly status = signal('');
  readonly receiptStatus = this.status.asReadonly();
  readonly receiptCategories = computed(() => this.categories().map(category => category.name));
  readonly canReadReceipt = computed(() => !this.loading() && this.receiptState().kind === 'idle' && this.receiptScope() !== null);
  private readonly confirmed = new Subject<{ sheetId: number; expenses: ReceiptExpense[] }>();
  readonly expenses$ = this.confirmed.asObservable();

  constructor() {
    effect(() => {
      const state = this.receiptState();
      if (state.kind !== 'idle' && !this.isReceiptScopeCurrent(state.scope)) this.cancelReceiptForContext();
    });
    inject(DestroyRef).onDestroy(() => this.cancelReceipt());
  }

  connect(date: Signal<Date>, sheet: Signal<Sheet | null>): void {
    this.cancelReceipt();
    this.context.set({ date, sheet });
  }

  recognizeReceipt(photo: Blob): void {
    if (!this.canReadReceipt()) return;
    const scope = this.receiptScope();
    if (!scope) return;
    const date = new Date(this.context()!.date());
    this.error.set('');
    this.status.set('');
    try {
      validateReceiptInput(photo, scope.categories, date);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : RECEIPT_ERRORS.photo);
      return;
    }
    this.state.set({ kind: 'recognizing', scope });
    this.receiptSubscription = this.recognition.recognizeReceipt(photo, scope.categories, date).subscribe({
      next: expenses => {
        if (!this.isReceiptScopeCurrent(scope)) {
          this.cancelReceiptForContext();
          return;
        }
        this.state.set({ kind: 'review', scope, expenses });
      },
      error: () => {
        this.state.set({ kind: 'idle' });
        this.error.set(RECEIPT_ERRORS.recognition);
      },
    });
  }

  cancelReceipt(): void {
    this.receiptSubscription?.unsubscribe();
    this.receiptSubscription = undefined;
    this.state.set({ kind: 'idle' });
    this.error.set('');
    this.status.set('');
  }

  confirmReceipt(rows: ReceiptExpense[]): void {
    const state = this.receiptState();
    if (state.kind !== 'review') return;
    if (!this.isReceiptScopeCurrent(state.scope)) {
      this.cancelReceiptForContext();
      return;
    }
    if (!rows.length || !rows.every(row => isValidReceiptDraftRow(row, state.scope.categories))) {
      this.error.set('Check the amount, category, and date for each receipt item.');
      return;
    }
    this.cancelReceipt();
    this.confirmed.next({
      sheetId: state.scope.sheetId,
      expenses: rows.map(({ amount, category, date, comment }) => ({ amount, category, date: new Date(date), comment })),
    });
  }

  private receiptScope(): ReceiptScope | null {
    const spreadsheetId = this.spreadsheetId();
    const sheet = this.context()?.sheet();
    const categories = this.receiptCategories();
    return spreadsheetId && sheet && categories.length ? { spreadsheetId, sheetId: sheet.id, categories } : null;
  }

  private isReceiptScopeCurrent(scope: ReceiptScope): boolean {
    const current = this.receiptScope();
    return (
      !!current &&
      current.spreadsheetId === scope.spreadsheetId &&
      current.sheetId === scope.sheetId &&
      current.categories.length === scope.categories.length &&
      current.categories.every((name, index) => name === scope.categories[index])
    );
  }

  private cancelReceiptForContext(): void {
    this.cancelReceipt();
    this.status.set('Receipt cancelled because the selected person, spreadsheet, or categories changed.');
  }
}
