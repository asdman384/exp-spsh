import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';

import { OutboxRecord } from 'src/shared/models';

import { OutboxFailureNoticeComponent, OutboxFailureNoticeData } from './outbox-failure-notice.component';

function makeRecord(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
  return {
    localId: 'r1',
    kind: 'addExpense',
    spreadsheetId: 'spsh-1',
    payload: {
      sheetId: 0,
      expense: { date: new Date(2024, 0, 1), amount: 10, category: 'Food', comment: '', isInDebt: false }
    },
    enqueuedAt: new Date(2024, 0, 5, 14, 7).getTime(),
    status: 'failed',
    attempts: 1,
    failure: 'rejected',
    ...overrides
  };
}

function setup(record: OutboxRecord): { fixture: ComponentFixture<OutboxFailureNoticeComponent>; dismiss: ReturnType<typeof vi.fn> } {
  const dismiss = vi.fn();

  TestBed.configureTestingModule({
    imports: [OutboxFailureNoticeComponent],
    providers: [
      { provide: MAT_SNACK_BAR_DATA, useValue: { record } as OutboxFailureNoticeData },
      { provide: MatSnackBarRef, useValue: { dismiss } }
    ]
  });

  const fixture = TestBed.createComponent(OutboxFailureNoticeComponent);
  fixture.detectChanges();

  return { fixture, dismiss };
}

// [AC31] Snackbar body for a `failed` outbox record (D13).
describe('[AC31] OutboxFailureNoticeComponent', () => {
  it('should_include_category_amount_and_the_d_MMM_HH_mm_date_in_the_rejected_label', () => {
    const record = makeRecord({
      failure: 'rejected',
      payload: { sheetId: 0, expense: { category: 'Food', amount: 12.5, comment: '', isInDebt: false } },
      enqueuedAt: new Date(2024, 0, 5, 14, 7).getTime()
    });

    const { fixture } = setup(record);
    const label = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(label).toContain('Food');
    expect(label).toContain('12.5');
    expect(label).toContain('5 Jan, 14:07');
    expect(label).toContain("Couldn't send a saved expense");
  });

  it('should_include_category_amount_and_the_d_MMM_HH_mm_date_in_the_otherSpreadsheet_label', () => {
    const record = makeRecord({
      failure: 'otherSpreadsheet',
      payload: { sheetId: 0, expense: { category: 'Transport', amount: 8, comment: '', isInDebt: false } },
      enqueuedAt: new Date(2024, 5, 20, 9, 3).getTime()
    });

    const { fixture } = setup(record);
    const label = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(label).toContain('Transport');
    expect(label).toContain('8');
    expect(label).toContain('20 Jun, 09:03');
    expect(label).toContain('belongs to a different spreadsheet');
  });

  it('should_render_exactly_three_buttons_named_Retry_Discard_and_Close', () => {
    const { fixture } = setup(makeRecord());

    const buttonTexts = fixture.debugElement
      .queryAll(By.css('button'))
      .map((de) => (de.nativeElement as HTMLElement).textContent?.trim());

    expect(buttonTexts).toEqual(['Retry', 'Discard', 'Close']);
  });

  it('should_set_choice_retry_and_dismiss_exactly_once_when_Retry_is_clicked', () => {
    const { fixture, dismiss } = setup(makeRecord());
    const buttons = fixture.debugElement.queryAll(By.css('button'));

    (buttons[0].nativeElement as HTMLElement).click();

    expect(fixture.componentInstance.choice()).toBe('retry');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('should_set_choice_discard_and_dismiss_exactly_once_when_Discard_is_clicked', () => {
    const { fixture, dismiss } = setup(makeRecord());
    const buttons = fixture.debugElement.queryAll(By.css('button'));

    (buttons[1].nativeElement as HTMLElement).click();

    expect(fixture.componentInstance.choice()).toBe('discard');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('should_set_choice_close_and_dismiss_exactly_once_when_Close_is_clicked', () => {
    const { fixture, dismiss } = setup(makeRecord());
    const buttons = fixture.debugElement.queryAll(By.css('button'));

    (buttons[2].nativeElement as HTMLElement).click();

    expect(fixture.componentInstance.choice()).toBe('close');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
