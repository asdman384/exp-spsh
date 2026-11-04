import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MAT_NATIVE_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import { AppActions } from 'src/@state';
import { TIME_FORMAT } from 'src/constants';
import { Expense, Sheet } from 'src/shared/models';
import { ExpensesTableComponent } from 'src/shared/components';
import { VoiceRecordButtonComponent } from 'src/shared/components/voice-record-button/voice-record-button.component';
import { DashboardPageViewModel } from './dashboard-page.view-model';

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
    VoiceRecordButtonComponent
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
            day: 'numeric'
          } as Intl.DateTimeFormatOptions
        }
      }
    }
  ]
})
export class DashboardPageContainer {
  private readonly viewModel = inject(DashboardPageViewModel);
  protected readonly loading$ = this.viewModel.loading$;
  protected readonly sheets$ = this.viewModel.sheets$;
  protected readonly categories$ = this.viewModel.categories$;
  protected readonly expenses = this.viewModel.expenses;
  protected readonly summary = this.viewModel.summary;
  protected readonly expenseModel = this.viewModel.expenseModel;
  protected readonly timeFormat = TIME_FORMAT;
  protected readonly minDate = new Date(new Date().getFullYear(), 0, 1);

  protected readonly expenseForm = form(this.expenseModel, (p) => {
    required(p.date);
    required(p.sheet);
    required(p.amount);
    required(p.category);
  });

  constructor() {
    inject(Store).dispatch(AppActions.setTitle({ title: 'Dashboard', icon: 'dashboard' }));
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

  protected loadCategories(): void {
    this.viewModel.loadCategories();
  }

  protected clearComment(): void {
    this.viewModel.clearComment();
  }

  protected handleDeleteExpense(expense: Expense): void {
    this.viewModel.deleteExpense(expense);
  }
}
