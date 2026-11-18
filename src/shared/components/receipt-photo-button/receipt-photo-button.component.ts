import { Component, DestroyRef, ElementRef, TemplateRef, ViewContainerRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTE } from 'src/constants';
import { ReceiptCameraComponent } from './receipt-camera.component';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RECEIPT_MIME_TYPES } from 'src/services/expense-recognition/receipt-recognition';
import { Sheet } from 'src/shared/models';
import { ReceiptReaderService } from './receipt-reader.service';
import { ReceiptReviewComponent } from './receipt-review.component';

@Component({
  selector: 'receipt-photo-button',
  imports: [MatButtonModule, MatIconModule, MatDialogContent, ReceiptReviewComponent, ReceiptCameraComponent],
  template: `
    <input #receiptInput type="file" hidden [accept]="receiptAccept" capture="environment" (change)="onReceiptSelected(receiptInput)" />
    <button
      style="width: 56px; height: 56px; padding: 16px"
      #receiptCamera
      mat-icon-button
      type="button"
      aria-label="Read receipt photo"
      [disabled]="!reader.canReadReceipt()"
      (click)="receiptInput.click()"
    >
      <mat-icon>photo_camera</mat-icon>
    </button>
    <ng-template #review>
      <mat-dialog-content>
        @if (capturing()) {
          <receipt-camera [sheet]="sheet()" (captured)="capturing.set(false)" (cancelled)="closeCamera()" />
        }
        @if (reader.receiptState(); as receipt) {
          @if (receipt.kind === 'recognizing') {
            <section aria-label="Receipt recognition">
              <p role="status">Reading receipt… Photo sent to Gemini. The app does not save it.</p>
              <button mat-button type="button" (click)="reader.cancelReceipt()">Cancel</button>
            </section>
          }
          @if (receipt.kind === 'review') {
            <receipt-review
              [sheetTitle]="sheet()?.title"
              [expenses]="receipt.expenses"
              [categories]="reader.receiptCategories()"
              (confirmed)="reader.confirmReceipt($event)"
              (cancelled)="reader.cancelReceipt()"
            />
          }
        }
        @if (reader.receiptError()) {
          <p role="alert">{{ reader.receiptError() }}</p>
        }
        @if (reader.receiptStatus()) {
          <p role="status">{{ reader.receiptStatus() }}</p>
        }
        @if (reader.receiptState().kind === 'idle' && !capturing()) {
          <button mat-button type="button" (click)="reader.cancelReceipt()">Close</button>
        }
      </mat-dialog-content>
    </ng-template>
  `,
})
export class ReceiptPhotoButtonComponent {
  readonly captureMode = input(false);
  protected readonly capturing = signal(false);
  private shortcutStarted = false;
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly date = input.required<Date>();
  readonly sheet = input.required<Sheet | null>();
  private readonly review = viewChild<TemplateRef<unknown>>('review');
  protected readonly reader = inject(ReceiptReaderService);
  protected readonly receiptAccept = RECEIPT_MIME_TYPES.join(',');
  private readonly dialog = inject(MatDialog);
  private dialogRef?: MatDialogRef<unknown>;
  private readonly receiptCamera = viewChild<unknown, ElementRef<HTMLButtonElement>>('receiptCamera', { read: ElementRef });

  constructor() {
    this.reader.connect(this.date, this.sheet);
    this.destroyRef.onDestroy(() => {
      this.reader.cancelReceipt();
      this.dialogRef?.close();
    });
    effect(() => {
      if (this.captureMode() && !this.shortcutStarted) {
        this.shortcutStarted = true;
        this.capturing.set(true);
      }
      const isActive =
        this.capturing() || this.reader.receiptState().kind !== 'idle' || !!this.reader.receiptError() || !!this.reader.receiptStatus();
      const template = this.review();
      if (isActive && template && !this.dialogRef) {
        const ref = this.dialog.open(template, {
          ariaLabel: this.shortcutStarted ? 'Receipt photo' : 'Receipt review',
          viewContainerRef: this.viewContainer,
          width: '720px',
          maxWidth: '95vw',
          restoreFocus: this.receiptCamera()?.nativeElement ?? true,
        });
        this.dialogRef = ref;
        ref.beforeClosed().subscribe(() => {
          this.capturing.set(false);
          this.reader.cancelReceipt();
        });
        ref.afterClosed().subscribe(() => {
          if (this.dialogRef === ref) this.dialogRef = undefined;
          if (this.shortcutStarted && !this.destroyRef.destroyed) void this.router.navigate([ROUTE.dashboard], { replaceUrl: true });
        });
      } else if (!isActive) {
        this.dialogRef?.close();
      }
    });
  }

  protected closeCamera(): void {
    this.dialogRef?.close();
  }

  protected onReceiptSelected(input: HTMLInputElement): void {
    const photo = input.files?.[0];
    input.value = '';
    if (photo) this.reader.recognizeReceipt(photo);
  }
}
