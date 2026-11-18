import { AfterViewInit, Component, DestroyRef, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { currentSheetIdSelector, loadingSelector, spreadsheetIdSelector } from 'src/@state';
import { RECEIPT_MAX_BYTES } from 'src/services/expense-recognition/receipt-recognition';
import { Sheet } from 'src/shared/models';
import { ReceiptReaderService } from './receipt-reader.service';

@Component({
  selector: 'receipt-camera',
  imports: [MatButtonModule],
  template: `
    <h2>Receipt photo</h2>
    <video
      #preview
      [hidden]="!!selection() || !!error()"
      autoplay
      muted
      playsinline
      aria-label="Camera preview"
      (loadeddata)="ready.set(true)"
      (error)="fail('Camera preview failed.')"
      style="width: 100%"
    ></video>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    } @else if (selection()) {
      <p role="status">{{ pending() ? 'Waiting for sheet data…' : 'Preparing photo…' }}</p>
    } @else {
      <button mat-button type="button" [disabled]="!ready()" (click)="capture()">Take photo</button>
    }
    <button mat-button type="button" (click)="cancel()">{{ error() ? 'Return to dashboard' : 'Cancel' }}</button>
  `,
})
export class ReceiptCameraComponent implements AfterViewInit {
  readonly sheet = input.required<Sheet | null>();
  readonly captured = output<void>();
  readonly cancelled = output<void>();
  private readonly reader = inject(ReceiptReaderService);
  private readonly store = inject(Store);
  private readonly book = this.store.selectSignal(spreadsheetIdSelector);
  private readonly person = this.store.selectSignal(currentSheetIdSelector);
  private readonly loading = this.store.selectSignal(loadingSelector);
  private readonly preview = viewChild.required<ElementRef<HTMLVideoElement>>('preview');
  protected readonly ready = signal(false);
  protected readonly error = signal('');
  protected readonly selection = signal<{ book: string | undefined; person: string | null; sheetId?: number } | null>(null);
  protected readonly pending = signal<Blob | null>(null);
  private stream?: MediaStream;
  private closed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
    inject(MatDialogRef, { optional: true })
      ?.beforeClosed()
      .subscribe(() => this.dispose());
    effect(() => {
      const target = this.selection();
      if (!target || this.closed) return;
      if (
        target.book !== this.book() ||
        target.person !== this.person() ||
        (target.sheetId !== undefined && this.sheet() && target.sheetId !== this.sheet()?.id)
      ) {
        this.fail('Photo discarded because the selected spreadsheet or person changed.');
        return;
      }
      const photo = this.pending();
      if (!photo || this.loading()) return;
      if (!target.book || !this.sheet() || this.sheet()?.title !== target.person) {
        this.fail('Select a spreadsheet and person before reading a receipt.');
      } else if (!this.reader.receiptCategories().length) {
        this.fail('Add categories before reading a receipt.');
      } else if (this.reader.canReadReceipt()) {
        this.pending.set(null);
        this.reader.recognizeReceipt(photo);
        this.captured.emit();
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
      if (this.closed) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      const video = this.preview().nativeElement;
      video.muted = true;
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      if (!this.closed && !this.selection())
        this.fail(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Camera access was denied.' : 'Camera unavailable.');
    }
  }

  protected capture(): void {
    if (!this.ready() || this.closed || this.selection()) return;
    const target = { book: this.book(), person: this.person(), sheetId: this.sheet()?.id };
    this.selection.set(target);
    try {
      const video = this.preview().nativeElement;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error();
      context.drawImage(video, 0, 0);
      this.stopStream();
      canvas.toBlob(photo => {
        if (this.closed || this.selection() !== target) return;
        if (!photo?.size || photo.type !== 'image/jpeg') this.fail('Could not capture a JPEG photo.');
        else if (photo.size > RECEIPT_MAX_BYTES) this.fail('The photo exceeds 10 MB.');
        else this.pending.set(photo);
      }, 'image/jpeg');
    } catch {
      this.fail('Could not capture the photo.');
    }
  }

  protected fail(message: string): void {
    this.dispose();
    this.error.set(message);
  }

  protected cancel(): void {
    this.dispose();
    this.cancelled.emit();
  }

  private dispose(): void {
    this.closed = true;
    this.selection.set(null);
    this.pending.set(null);
    this.stopStream();
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = undefined;
  }
}
