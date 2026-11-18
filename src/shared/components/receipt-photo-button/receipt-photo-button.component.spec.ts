import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject, of } from 'rxjs';
import { categoriesSelector, currentSheetIdSelector, loadingSelector } from 'src/@state';
import { ExpenseRecognitionService } from 'src/services';
import { ReceiptExpense } from 'src/services/expense-recognition/receipt-recognition';
import { ReceiptPhotoButtonComponent } from './receipt-photo-button.component';
import { ReceiptReaderService } from './receipt-reader.service';

@Component({
  imports: [ReceiptPhotoButtonComponent],
  providers: [ReceiptReaderService],
  template: `
    <form (submit)="submitted($event)">
      <receipt-photo-button [captureMode]="shortcut" [date]="date" [sheet]="sheet" />
    </form>
  `,
})
class HostComponent {
  shortcut = false;
  readonly date = new Date(2026, 10, 7);
  readonly sheet = { id: 1, title: 'Person' };
  readonly submitted = vi.fn((event: Event) => event.preventDefault());
}

describe('Receipt photo entry', () => {
  it('opens the shortcut camera once and replaces the URL on exit', async () => {
    const navigate = vi.fn();
    const request = vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new DOMException('', 'NotAllowedError'));
    try {
      TestBed.configureTestingModule({
        providers: [
          { provide: Router, useValue: { navigate } },
          { provide: ExpenseRecognitionService, useValue: {} },
          { provide: Store, useValue: { selectSignal: () => signal('book'), select: () => of([]) } },
        ],
      });
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.shortcut = true;
      fixture.detectChanges();
      await expect.poll(() => document.querySelector('receipt-camera [role=alert]')?.textContent).toContain('denied');
      document.querySelector<HTMLButtonElement>('receipt-camera button')!.click();
      await expect.poll(() => navigate.mock.calls.length).toBe(1);
      expect(navigate).toHaveBeenCalledWith(['dashboard'], { replaceUrl: true });
      expect(request).toHaveBeenCalledTimes(1);
      fixture.destroy();
    } finally {
      request.mockRestore();
    }
  });

  it('reviews and confirms a shortcut photo in the same dialog', async () => {
    const navigate = vi.fn();
    const row = { amount: 12, category: 'Food', date: new Date(2026, 10, 7), comment: 'bread' };
    const recognizeReceipt = vi.fn(() => of([row]));
    const stream = new MediaStream();
    const photo = new Blob(['receipt'], { type: 'image/jpeg' });
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(stream);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage').mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(photo));
    try {
      TestBed.configureTestingModule({
        providers: [
          { provide: Router, useValue: { navigate } },
          { provide: ExpenseRecognitionService, useValue: { recognizeReceipt } },
          {
            provide: Store,
            useValue: {
              selectSignal: (selector: unknown) =>
                signal(selector === loadingSelector ? false : selector === currentSheetIdSelector ? 'Person' : 'book'),
              select: (selector: unknown) => of(selector === categoriesSelector ? [{ id: 0, name: 'Food' }] : false),
            },
          },
        ],
      });
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.shortcut = true;
      fixture.detectChanges();
      await fixture.whenStable();
      const confirmed = vi.fn();
      fixture.debugElement.injector.get(ReceiptReaderService).expenses$.subscribe(confirmed);
      const dialog = document.querySelector<HTMLElement>('[role=dialog]')!;
      dialog.querySelector('video')!.dispatchEvent(new Event('loadeddata'));
      await fixture.whenStable();
      dialog.querySelector<HTMLButtonElement>('receipt-camera button')!.click();
      await fixture.whenStable();
      expect(recognizeReceipt).toHaveBeenCalledExactlyOnceWith(photo, ['Food'], row.date);
      dialog.querySelector<HTMLButtonElement>('receipt-review button[type=submit]')!.click();
      await expect.poll(() => navigate.mock.calls.length).toBe(1);
      expect(confirmed).toHaveBeenCalledExactlyOnceWith({ sheetId: 1, expenses: [row] });
      fixture.destroy();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('selects a photo, confirms outside the parent form, and restores camera focus', async () => {
    const result = new Subject<ReceiptExpense[]>();
    const recognizeReceipt = vi.fn(() => result);
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: ExpenseRecognitionService, useValue: { recognizeReceipt } },
        {
          provide: Store,
          useValue: {
            selectSignal: () => signal('book'),
            select: (selector: unknown) =>
              of(selector === categoriesSelector ? [{ id: 0, name: 'Food' }] : selector === loadingSelector ? false : []),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const reader = fixture.debugElement.injector.get(ReceiptReaderService);
    const confirmed = vi.fn();
    reader.expenses$.subscribe(confirmed);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
    const photo = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
    const files = new DataTransfer();
    files.items.add(photo);
    input.files = files.files;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(recognizeReceipt).toHaveBeenCalledExactlyOnceWith(photo, ['Food'], fixture.componentInstance.date);
    const row = { amount: 12, category: 'Food', date: fixture.componentInstance.date, comment: 'bread' };
    result.next([row]);
    fixture.detectChanges();
    await fixture.whenStable();
    const review: HTMLElement = document.querySelector<HTMLElement>('receipt-review')!;
    expect(review.closest('form')).toBeNull();
    expect(review.closest('[role=dialog]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('receipt-review')).toBeNull();
    expect(confirmed).not.toHaveBeenCalled();
    review.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(confirmed).toHaveBeenCalledExactlyOnceWith({ sheetId: 1, expenses: [row] });
    expect(fixture.componentInstance.submitted).not.toHaveBeenCalled();
    await expect.poll(() => document.activeElement).toBe(fixture.nativeElement.querySelector('[aria-label="Read receipt photo"]'));
    await expect.poll(() => document.querySelector('[role=dialog]')).toBeNull();
    const nextFiles = new DataTransfer();
    nextFiles.items.add(photo);
    input.files = nextFiles.files;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(recognizeReceipt).toHaveBeenCalledTimes(2);
    expect(reader.receiptState().kind).toBe('recognizing');
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(reader.receiptState().kind).toBe('idle');
    await expect.poll(() => document.querySelector('[role=dialog]')).toBeNull();
    expect(confirmed).toHaveBeenCalledTimes(1);
    await expect.poll(() => document.activeElement).toBe(fixture.nativeElement.querySelector('[aria-label="Read receipt photo"]'));
    fixture.destroy();
  });
});
