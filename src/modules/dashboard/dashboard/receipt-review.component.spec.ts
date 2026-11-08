import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReceiptExpense } from 'src/services/expense-recognition/receipt-recognition';
import { ReceiptReviewComponent } from './receipt-review.component';

describe('ReceiptReviewComponent', () => {
  let fixture: ComponentFixture<ReceiptReviewComponent>;
  const rows: ReceiptExpense[] = [
    { amount: 12.5, category: 'Food', date: new Date(2026, 10, 7), comment: 'bread' },
    { amount: 5, category: 'Home', date: new Date(2026, 10, 7), comment: 'soap' },
  ];
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReceiptReviewComponent] }).compileComponents();
    fixture = TestBed.createComponent(ReceiptReviewComponent);
    fixture.componentRef.setInput('expenses', rows);
    fixture.componentRef.setInput('categories', ['Food', 'Home']);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  function button(text: string): HTMLButtonElement {
    return [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)].find(element =>
      element.textContent?.includes(text),
    )!;
  }
  function inputValue(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }
  it('focuses the heading and shows rows, the total, and the photo disclosure', () => {
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('h2'));
    expect(fixture.nativeElement.textContent).toContain('17.50');
    expect(fixture.nativeElement.textContent).toContain('Photo sent to Gemini. The app does not save it.');
    expect(fixture.nativeElement.querySelectorAll('input[type=number]')).toHaveLength(2);
  });
  it('emits edited values only after explicit confirmation', () => {
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    inputValue('input[type=number]', '20');
    inputValue('input[data-comment]', 'new comment');
    expect(confirmed).not.toHaveBeenCalled();
    button('Add expenses').click();
    expect(confirmed).toHaveBeenCalledExactlyOnceWith([{ ...rows[0], amount: 20, comment: 'new comment' }, rows[1]]);
    expect(rows[0].amount).toBe(12.5);
  });
  it('disables confirmation for invalid values and allows correction', () => {
    inputValue('input[type=number]', '0');
    expect(button('Add expenses').disabled).toBe(true);
    inputValue('input[type=number]', '9');
    expect(button('Add expenses').disabled).toBe(false);
  });
  it('removes rows, moves focus, and disables an empty draft', async () => {
    const remove = fixture.nativeElement.querySelector('[aria-label="Remove receipt item 1"]') as HTMLButtonElement;
    remove.focus();
    remove.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('input[type=number]')).toHaveLength(1);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input[type=number]'));
    (fixture.nativeElement.querySelector('[aria-label="Remove receipt item 1"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(button('Add expenses').disabled).toBe(true);
    expect(document.activeElement).toBe(button('Cancel'));
  });
  it('cancels without confirmation', () => {
    const confirmed = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    button('Cancel').click();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(confirmed).not.toHaveBeenCalled();
  });
});
