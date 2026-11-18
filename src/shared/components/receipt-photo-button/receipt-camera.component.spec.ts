import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { currentSheetIdSelector, loadingSelector } from 'src/@state';
import { RECEIPT_MAX_BYTES } from 'src/services/expense-recognition/receipt-recognition';
import { ReceiptCameraComponent } from './receipt-camera.component';
import { ReceiptReaderService } from './receipt-reader.service';

describe('Receipt camera', () => {
  const loading = signal(false);
  const person = signal('Person');
  const book = signal('book');
  const categories = signal(['Food']);
  const recognizeReceipt = vi.fn();
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream;
  const jpeg = new Blob(['receipt'], { type: 'image/jpeg' });
  let encode: BlobCallback;

  beforeEach(() => {
    vi.clearAllMocks();
    loading.set(false);
    person.set('Person');
    book.set('book');
    categories.set(['Food']);
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(stream);
    vi.spyOn(HTMLMediaElement.prototype, 'srcObject', 'set').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage').mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => {
      encode = callback;
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Store,
          useValue: {
            selectSignal: (selector: unknown) =>
              selector === loadingSelector ? loading : selector === currentSheetIdSelector ? person : book,
          },
        },
        { provide: ReceiptReaderService, useValue: { canReadReceipt: () => !loading(), receiptCategories: categories, recognizeReceipt } },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  function open() {
    const fixture = TestBed.createComponent(ReceiptCameraComponent);
    fixture.componentRef.setInput('sheet', { id: 0, title: 'Person' });
    fixture.detectChanges();
    return fixture;
  }

  async function take(withSheet = true) {
    const fixture = open();
    await fixture.whenStable();
    if (!withSheet) fixture.componentRef.setInput('sheet', null);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('button')?.disabled).toBe(true);
    root.querySelector('video')!.dispatchEvent(new Event('loadeddata'));
    fixture.detectChanges();
    root.querySelector('button')!.click();
    expect(stop).toHaveBeenCalledTimes(2);
    fixture.detectChanges();
    return fixture;
  }

  it.each([false, true])('hands one JPEG to the reader with loading=%s', async delayed => {
    loading.set(delayed);
    const fixture = await take();
    encode(jpeg);
    fixture.detectChanges();
    if (delayed) {
      expect(recognizeReceipt).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('Waiting');
    }
    loading.set(false);
    fixture.detectChanges();
    loading.set(true);
    fixture.detectChanges();
    expect(recognizeReceipt).toHaveBeenCalledExactlyOnceWith(jpeg);
  });

  it('waits for the selected sheet entity and accepts sheet ID zero', async () => {
    loading.set(true);
    const fixture = await take(false);
    encode(jpeg);
    fixture.detectChanges();
    expect(recognizeReceipt).not.toHaveBeenCalled();
    fixture.componentRef.setInput('sheet', { id: 0, title: 'Person' });
    loading.set(false);
    fixture.detectChanges();
    expect(recognizeReceipt).toHaveBeenCalledExactlyOnceWith(jpeg);
  });

  it.each(['cancel encoding', 'cancel waiting', 'person', 'spreadsheet'])('discards the photo on %s', async reason => {
    loading.set(true);
    const fixture = await take();
    if (reason !== 'cancel encoding') encode(jpeg);
    if (reason.startsWith('cancel')) fixture.nativeElement.querySelector('button').click();
    else if (reason === 'person') person.set('Other');
    else book.set('Other');
    fixture.detectChanges();
    if (reason === 'cancel encoding') encode(jpeg);
    loading.set(false);
    fixture.detectChanges();
    expect(recognizeReceipt).not.toHaveBeenCalled();
  });

  it.each(['sheet', 'categories', 'empty', 'oversize', 'encoding'])('explains %s failure', async reason => {
    const fixture = await take();
    if (reason === 'sheet') fixture.componentRef.setInput('sheet', null);
    if (reason === 'categories') categories.set([]);
    encode(
      reason === 'encoding'
        ? null
        : reason === 'oversize'
          ? new Blob([new Uint8Array(RECEIPT_MAX_BYTES + 1)], { type: 'image/jpeg' })
          : reason === 'empty'
            ? new Blob([])
            : jpeg,
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toMatch(/select|categories|capture|exceeds/i);
    expect(recognizeReceipt).not.toHaveBeenCalled();
  });

  it.each(['NotAllowedError', 'NotFoundError'])('shows camera failure for %s', async name => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException('', name));
    const fixture = open();
    await fixture.whenStable();
    await expect.poll(() => fixture.nativeElement.textContent).toContain(name === 'NotAllowedError' ? 'denied' : 'unavailable');
  });

  it.each([false, true])('releases a delayed stream with early exit=%s', async exit => {
    let grant!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(
      new Promise(resolve => {
        grant = resolve;
      }),
    );
    const fixture = open();
    if (exit) fixture.destroy();
    grant(stream);
    await Promise.resolve();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(exit ? 0 : 1);
    if (!exit) fixture.destroy();
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
