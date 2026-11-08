import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, ElementRef, afterNextRender, effect, inject, Injector, viewChild } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MAT_NATIVE_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import { AppActions } from 'src/@state';
import { TIME_FORMAT } from 'src/constants';
import { ExpenseTableRow, Sheet } from 'src/shared/models';
import { ExpensesTableComponent } from 'src/shared/components';
import { VoiceRecordButtonComponent } from 'src/shared/components/voice-record-button/voice-record-button.component';
import { DashboardPageViewModel } from './dashboard-page.view-model';
import { ReceiptReviewComponent } from './receipt-review.component';
import { RECEIPT_MIME_TYPES, ReceiptExpense } from 'src/services/expense-recognition/receipt-recognition';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.container.html',
  styleUrl: './dashboard-page.container.scss',
  imports: [
    FormField,
    AsyncPipe,
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    ExpensesTableComponent,
    VoiceRecordButtonComponent,
    ReceiptReviewComponent,
  ],
  providers: [
    DashboardPageViewModel,
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    {
      provide: MAT_DATE_FORMATS,
      useValue: {
        ...MAT_NATIVE_DATE_FORMATS,
        display: {
          ...MAT_NATIVE_DATE_FORMATS.display,
          dateInput: {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          } as Intl.DateTimeFormatOptions,
        },
      },
    },
  ],
})
export class DashboardPageContainer {
  private datePointer: { id: number; x: number; y: number } | null = null;
  private suppressDateClick = false;
  private readonly viewModel = inject(DashboardPageViewModel);
  private readonly injector = inject(Injector);
  private readonly receiptCamera = viewChild<unknown, ElementRef<HTMLButtonElement>>('receiptCamera', { read: ElementRef });
  protected readonly receiptState = this.viewModel.receiptState;
  protected readonly receiptError = this.viewModel.receiptError;
  protected readonly receiptStatus = this.viewModel.receiptStatus;
  protected readonly receiptCategories = this.viewModel.receiptCategories;
  protected readonly canReadReceipt = this.viewModel.canReadReceipt;
  protected readonly receiptAccept = RECEIPT_MIME_TYPES.join(',');
  protected readonly loading$ = this.viewModel.loading$;
  protected readonly sheets$ = this.viewModel.sheets$;
  protected readonly categories$ = this.viewModel.categories$;
  protected readonly expenses = this.viewModel.expenses;
  protected readonly summary = this.viewModel.summary;
  protected readonly expenseModel = this.viewModel.expenseModel;
  protected readonly timeFormat = TIME_FORMAT;
  protected readonly minDate = new Date(new Date().getFullYear(), 0, 1);

  protected readonly expenseForm = form(this.expenseModel, p => {
    required(p.date);
    required(p.sheet);
    required(p.amount);
    required(p.category);
  });

  constructor() {
    inject(Store).dispatch(AppActions.setTitle({ title: 'Dashboard', icon: 'dashboard' }));
    let active = false;
    effect(() => {
      const isActive = this.receiptState().kind !== 'idle';
      if (active && !isActive) afterNextRender(() => this.receiptCamera()?.nativeElement.focus(), { injector: this.injector });
      active = isActive;
    });
  }

  protected onReceiptSelected(input: HTMLInputElement): void {
    const photo = input.files?.[0];
    input.value = '';
    if (photo) this.viewModel.recognizeReceipt(photo);
  }

  protected cancelReceipt(): void {
    this.viewModel.cancelReceipt();
  }

  protected confirmReceipt(expenses: ReceiptExpense[]): void {
    this.viewModel.confirmReceipt(expenses);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.expenseForm().valid() && this.viewModel.saveExpense()) {
      this.expenseForm().reset(this.expenseModel());
    }
  }

  protected onSheetChange(sheet: Sheet): void {
    this.viewModel.changeSheet(sheet);
  }

  protected onDateChange(date: Date): void {
    this.viewModel.changeDate(date);
  }

  protected startDateSwipe(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) return;
    this.suppressDateClick = false;
    this.datePointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected finishDateSwipe(event: PointerEvent, overlay: HTMLElement): void {
    const start = this.datePointer;
    if (!start || start.id !== event.pointerId) return;
    this.datePointer = null;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    this.suppressDateClick = Math.hypot(x, y) > 8;
    if (Math.abs(x) >= 40 && Math.abs(x) > Math.abs(y)) {
      this.onDateSwipe(x > 0 ? 'right' : 'left', overlay);
    }
  }

  protected cancelDateSwipe(): void {
    if (!this.datePointer) return;
    this.datePointer = null;
    this.suppressDateClick = true;
  }

  protected openDateCalendar(event: MouseEvent, picker: MatDatepicker<Date>): void {
    if (event.detail === 0 || !this.suppressDateClick) {
      picker.open();
    }
    this.suppressDateClick = false;
  }

  protected onDateSwipe(direction: 'left' | 'right', overlay: HTMLElement): void {
    const date = new Date(this.expenseModel().date);
    date.setDate(date.getDate() + (direction === 'left' ? -1 : 1));
    this.onDateChange(date);
    overlay.getAnimations().forEach(animation => animation.cancel());
    const positions = direction === 'right' ? ['100% 0', '0% 0'] : ['0% 0', '100% 0'];
    overlay.animate(
      [
        { backgroundPosition: positions[0], opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { backgroundPosition: positions[1], opacity: 0 },
      ],
      { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450, easing: 'ease-out' },
    );
  }

  protected loadCategories(): void {
    this.viewModel.loadCategories();
  }

  protected clearComment(): void {
    this.viewModel.clearComment();
  }

  protected handleDeleteExpense(expense: ExpenseTableRow): void {
    this.viewModel.deleteExpense(expense);
  }
}
