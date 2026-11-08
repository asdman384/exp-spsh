import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  Injector,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ReceiptExpense, isValidReceiptDraftRow } from 'src/services/expense-recognition/receipt-recognition';

@Component({
  selector: 'receipt-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatNativeDateModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  styleUrl: './receipt-review.component.scss',
  template: `
    <section aria-labelledby="receipt-heading">
      <h2 id="receipt-heading" #heading tabindex="-1">Review receipt</h2>
      <p>Photo sent to Gemini. The app does not save it.</p>
      <form (submit)="confirm($event)">
        @for (row of rows.controls; track row; let i = $index) {
          <fieldset [formGroup]="row">
            <legend>Item {{ i + 1 }}</legend>
            <mat-form-field appearance="outline">
              <mat-label>Amount</mat-label>
              <input matInput type="number" inputmode="decimal" formControlName="amount" step="any" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Category</mat-label>
              <mat-select formControlName="category">
                @for (category of categories(); track category) {
                  <mat-option [value]="category">{{ category }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Date</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="date" />
              <mat-datepicker-toggle matIconSuffix [for]="picker" />
              <mat-datepicker #picker />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Comment</mat-label>
              <input matInput data-comment formControlName="comment" />
            </mat-form-field>
            <button mat-button type="button" [attr.aria-label]="'Remove receipt item ' + (i + 1)" (click)="remove(i)">Remove</button>
          </fieldset>
        } @empty {
          <p>No receipt items remain.</p>
        }
        <p role="status">Total: {{ total() | number: '1.2-2' }}</p>
        <div class="actions">
          <button mat-flat-button type="submit" [disabled]="!valid()">Add expenses</button>
          <button #cancelButton mat-button type="button" (click)="cancelled.emit()">Cancel</button>
        </div>
      </form>
    </section>
  `,
})
export class ReceiptReviewComponent {
  readonly expenses = input.required<ReceiptExpense[]>();
  readonly categories = input.required<ReadonlyArray<string>>();
  readonly confirmed = output<ReceiptExpense[]>();
  readonly cancelled = output<void>();
  private readonly injector = inject(Injector);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly cancelButton = viewChild.required<unknown, ElementRef<HTMLButtonElement>>('cancelButton', { read: ElementRef });
  readonly rows = new FormArray<
    FormGroup<{
      amount: FormControl<number>;
      category: FormControl<string>;
      date: FormControl<Date>;
      comment: FormControl<string>;
    }>
  >([]);

  constructor() {
    effect(() => {
      this.rows.clear();
      for (const row of this.expenses()) {
        this.rows.push(
          new FormGroup({
            amount: new FormControl(row.amount, { nonNullable: true, validators: [Validators.required, Validators.min(Number.MIN_VALUE)] }),
            category: new FormControl(row.category, { nonNullable: true, validators: [Validators.required] }),
            date: new FormControl(new Date(row.date), { nonNullable: true, validators: [Validators.required] }),
            comment: new FormControl(row.comment, { nonNullable: true }),
          }),
        );
      }
    });
    afterNextRender(() => this.heading().nativeElement.focus());
  }

  valid(): boolean {
    return this.rows.valid && this.rows.length > 0 && this.rows.getRawValue().every(row => isValidReceiptDraftRow(row, this.categories()));
  }

  total(): number {
    return this.rows.getRawValue().reduce((sum, row) => sum + (Number.isFinite(row.amount) && row.amount > 0 ? row.amount : 0), 0);
  }

  confirm(event: Event): void {
    event.preventDefault();
    this.rows.markAllAsTouched();
    if (this.valid()) this.confirmed.emit(this.rows.getRawValue());
  }

  remove(index: number): void {
    this.rows.removeAt(index);
    afterNextRender(
      () => {
        const inputs = this.element.nativeElement.querySelectorAll<HTMLInputElement>('input[type=number]');
        (inputs[Math.min(index, inputs.length - 1)] ?? this.cancelButton().nativeElement).focus();
      },
      { injector: this.injector },
    );
  }
}
