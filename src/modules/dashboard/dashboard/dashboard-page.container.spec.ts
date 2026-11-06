import { CdkDrag } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { signal, WritableSignal } from '@angular/core';

import { categoriesSelector, currentSheetSelector, loadingSelector, sheetsSelector } from 'src/@state';
import { VoiceRecorderOutcomeEvent, VoiceRecorderService, VoiceRecorderStatus } from 'src/services';

import { By } from '@angular/platform-browser';
import { OutboxService } from 'src/services/outbox/outbox.service';
import { Expense, OutboxRecord, Sheet } from 'src/shared/models';

import { ExpensesService } from '../expenses.service';
import { DashboardPageContainer } from './dashboard-page.container';
import { DashboardPageViewModel } from './dashboard-page.view-model';

class FakeVoiceRecorderService {
  readonly status = signal<VoiceRecorderStatus>('idle');
  readonly latest = signal(null);
  readonly lastOutcome = signal<VoiceRecorderOutcomeEvent | null>(null);
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeExpensesService {
  readonly expenses = signal<Expense[]>([]);
  readonly load = vi.fn();
  readonly add = vi.fn();
  readonly delete = vi.fn();
}

describe('DashboardPageContainer', () => {
  let fixture: ComponentFixture<DashboardPageContainer>;
  let dispatchSpy: ReturnType<typeof vi.fn>;
  let recorder: FakeVoiceRecorderService;
  let expensesService: FakeExpensesService;
  let records: WritableSignal<OutboxRecord[]>;
  let discard: ReturnType<typeof vi.fn>;

  afterEach(() => vi.unstubAllGlobals());

  beforeEach(async () => {
    vi.stubGlobal('log', vi.fn());
    dispatchSpy = vi.fn();
    recorder = new FakeVoiceRecorderService();
    expensesService = new FakeExpensesService();
    records = signal([]);
    discard = vi.fn((id: string) => records.update((all) => all.filter((r) => r.localId !== id)));

    const selectMock = vi.fn((selector: unknown) => {
      if (selector === sheetsSelector) return of([]);
      if (selector === categoriesSelector) return of([]);
      if (selector === currentSheetSelector) return of(undefined);
      if (selector === loadingSelector) return of(false);
      return of(undefined);
    });

    await TestBed.configureTestingModule({
      imports: [DashboardPageContainer],
      providers: [
        { provide: Store, useValue: { select: selectMock, selectSignal: () => signal('book'), dispatch: dispatchSpy } },
        { provide: VoiceRecorderService, useValue: recorder },
        { provide: ExpensesService, useValue: expensesService },
        { provide: OutboxService, useValue: { records, discard } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPageContainer);
    fixture.detectChanges();
  });

  function submitRows(): NodeListOf<HTMLElement> {
    return fixture.nativeElement.querySelectorAll('.submit-row');
  }

  describe('Date swipe overlay', () => {
    it.each([
      { x: -80, from: new Date(2026, 0, 1), to: new Date(2025, 11, 31) },
      { x: 80, from: new Date(2026, 11, 31), to: new Date(2027, 0, 1) },
      { x: -80, from: new Date(2028, 2, 1), to: new Date(2028, 1, 29) },
      { x: 80, from: new Date(2026, 2, 29), to: new Date(2026, 2, 30) }
    ])('changes the selected calendar day on swipe ($x, $from)', ({ x, from, to }) => {
      const model = fixture.debugElement.injector.get(DashboardPageViewModel);
      model.expenseModel.update((value) => ({ ...value, date: from, sheet: { id: 7, title: 'A' } }));
      fixture.detectChanges();
      expensesService.load.mockClear();
      gesture(x);
      expect(model.expenseModel().date.toDateString()).toBe(to.toDateString());
      expect(from.getTime()).not.toBe(model.expenseModel().date.getTime());
      expect(expensesService.load).toHaveBeenCalledExactlyOnceWith({ sheetId: 7, to: model.expenseModel().date });
    });

    function gesture(x: number, y = 0, end = 'pointerup'): HTMLButtonElement {
      const overlay = fixture.nativeElement.querySelector('.date-swipe-overlay') as HTMLButtonElement;
      expect(overlay).not.toBeNull();
      vi.spyOn(overlay, 'setPointerCapture').mockImplementation(() => undefined);
      overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, isPrimary: true, clientX: 100, clientY: 100 }));
      overlay.dispatchEvent(new PointerEvent(end, { bubbles: true, pointerId: 1, clientX: 100 + x, clientY: 100 + y }));
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      fixture.detectChanges();
      return overlay;
    }

    it.each([{ x: 80, direction: 'right' }, { x: -80, direction: 'left' }])('changes the date on a $direction swipe and animates without opening the calendar', ({ x }) => {
      const model = fixture.debugElement.injector.get(DashboardPageViewModel);
      const changeDate = vi.spyOn(model, 'changeDate');
      const overlay = gesture(x);
      expect(changeDate).toHaveBeenCalledExactlyOnceWith(model.expenseModel().date);
      expect(overlay.getAnimations()).toHaveLength(1);
      expect(document.querySelector('mat-calendar')).toBeNull();
      changeDate.mockRestore();
    });

    it.each([{ x: 10, y: 80, end: 'pointerup' }, { x: 80, y: 0, end: 'pointercancel' }])('ignores vertical and cancelled gestures', ({ x, y, end }) => {
      const model = fixture.debugElement.injector.get(DashboardPageViewModel);
      const changeDate = vi.spyOn(model, 'changeDate');
      const overlay = gesture(x, y, end);
      expect(changeDate).not.toHaveBeenCalled();
      expect(overlay.getAnimations()).toHaveLength(0);
      expect(document.querySelector('mat-calendar')).toBeNull();
      changeDate.mockRestore();
    });

    it('opens the calendar on a tap', () => {
      gesture(2);
      expect(document.querySelector('mat-calendar')).not.toBeNull();
    });
  });

  function lastSubmitRow(): HTMLElement {
    const rows = submitRows();
    return rows[rows.length - 1];
  }

  it('renders the summary after the form and before the table', () => {
    const summary: HTMLElement = fixture.nativeElement.querySelector('.expense-summary');
    expect(summary.textContent).toContain('Select a person to view totals');
    expect(summary.getAttribute('role')).toBe('status');
    expect(fixture.nativeElement.querySelector('form').compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary.compareDocumentPosition(fixture.nativeElement.querySelector('expenses-table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const page = fixture.componentInstance as unknown as {
      expenseModel: WritableSignal<{ date: Date; sheet: Sheet | null; amount: number | null;
        category: string | null; comment: string; isInDebt: boolean }>;
    };
    const date = new Date(2024, 10, 4, 12);
    page.expenseModel.update((value) => ({ ...value, date, sheet: { id: 1, title: 'A' } }));
    expensesService.expenses.set([{ amount: 1234.5, date }, { amount: 24, date, isInDebt: true }]);
    fixture.detectChanges();
    expect(summary.textContent?.replace(/\s+/g, ' ').trim()).toBe('Daily: 1258.50 · November: 1258.50 · Debt: 24');
    expensesService.expenses.set([]);
    fixture.detectChanges();
    expect(summary.textContent?.replace(/\s+/g, ' ').trim()).toBe('Daily: 0.00 · November: 0.00 · Debt: 0');
  });

  it('wraps totals inside 320 CSS pixels with text enlarged to 200 percent', () => {
    const page = fixture.componentInstance as unknown as {
      expenseModel: WritableSignal<{ date: Date; sheet: Sheet | null; amount: number | null;
        category: string | null; comment: string; isInDebt: boolean }>;
    };
    const date = new Date(2024, 10, 4, 12);
    page.expenseModel.update((value) => ({ ...value, date, sheet: { id: 1, title: 'A' } }));
    expensesService.expenses.set([{ amount: 1e100, date, isInDebt: true }]);
    const host: HTMLElement = fixture.nativeElement;
    host.style.display = 'block';
    host.style.width = '320px';
    const summary = host.querySelector<HTMLElement>('.expense-summary')!;
    summary.style.fontSize = '32px';
    fixture.detectChanges();
    expect(summary.scrollWidth).toBeLessThanOrEqual(summary.clientWidth);
    const groups = summary.querySelectorAll('span');
    expect(groups).toHaveLength(3);
    expect(groups[2].getBoundingClientRect().top).toBeGreaterThan(groups[0].getBoundingClientRect().top);
    for (const group of groups) {
      expect(group.getBoundingClientRect().right).toBeLessThanOrEqual(summary.getBoundingClientRect().right);
    }
  });

  it('queues a submitted expense and resets fields while retaining the date and sheet', () => {
    const page = fixture.componentInstance as unknown as {
      expenseModel: WritableSignal<{ date: Date; sheet: Sheet | null; amount: number | null;
        category: string | null; comment: string; isInDebt: boolean }>;
    };
    const date = new Date(2026, 0, 15, 12, 30);
    const sheet = { id: 7, title: 'data_test' };
    page.expenseModel.set({ date, sheet, amount: 42, category: 'Food', comment: 'Lunch', isInDebt: true });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));

    expect(expensesService.add).toHaveBeenCalledWith(7, expect.objectContaining({
      date, amount: 42, category: 'Food', comment: 'Lunch', isInDebt: true
    }));
    expect(page.expenseModel()).toEqual({ date, sheet, amount: null, category: null, comment: '', isInDebt: false });
  });

  it('does not submit an incomplete form or delete without a selected sheet', () => {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    const page = fixture.componentInstance as unknown as { handleDeleteExpense(expense: Expense): void };
    page.handleDeleteExpense({ amount: 10 });
    expect(expensesService.add).not.toHaveBeenCalled();
    expect(expensesService.delete).not.toHaveBeenCalled();
  });

  it.each(['pending', 'failed'] as const)('routes a %s table swipe to local discard', (status) => {
    const page = fixture.componentInstance as unknown as {
      expenseModel: WritableSignal<{ date: Date; sheet: Sheet | null; amount: number | null;
        category: string | null; comment: string; isInDebt: boolean }>;
    };
    const date = new Date(2026, 10, 5, 12);
    page.expenseModel.update((value) => ({ ...value, date, sheet: { id: 1, title: 'A' } }));
    const expense = { date, amount: 42, category: 'Food' };
    records.set([{ localId: 'queued', kind: 'addExpense', spreadsheetId: 'book', enqueuedAt: 0,
      attempts: 0, status, payload: { sheetId: 1, expense } }]);
    fixture.detectChanges();
    const row = fixture.debugElement.query(By.css('tr.queued-row'));
    expect(row).not.toBeNull();
    expect(fixture.nativeElement.querySelector('td.mat-column-date')).toBeNull();
    row.triggerEventHandler('cdkDragEnded', { distance: { x: 150, y: 0 }, source: row.injector.get(CdkDrag) });
    fixture.detectChanges();
    expect(discard).toHaveBeenCalledExactlyOnceWith('queued');
    expect(expensesService.delete).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('tr.queued-row')).toBeNull();
    expect(fixture.nativeElement.querySelector('.expense-summary').textContent).toContain('0.00');
  });

  // [AC1]
  describe('[AC1] rendering and wiring', () => {
    it('should_render_the_add_expense_button_followed_by_voice_record_button_in_the_last_submit_row', () => {
      const row = lastSubmitRow();
      const addExpenseButton = row.querySelector('button.submit-button');
      const voiceRecordButtonEl = row.querySelector('voice-record-button');

      expect(addExpenseButton).not.toBeNull();
      expect(voiceRecordButtonEl).not.toBeNull();

      // followed by, in DOM order
      const position = addExpenseButton!.compareDocumentPosition(voiceRecordButtonEl!);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('should_render_the_voice_record_buttons_inner_control_as_a_56x56_button_with_the_hold_to_record_aria_label', () => {
      const innerButton = lastSubmitRow().querySelector('voice-record-button button') as HTMLButtonElement;

      expect(innerButton).not.toBeNull();
      expect(innerButton.getAttribute('type')).toBe('button');
      expect(innerButton.getAttribute('aria-label')).toBe('Hold to record voice note');

      const rect = innerButton.getBoundingClientRect();
      expect(rect.width).toBe(56);
      expect(rect.height).toBe(56);
    });
  });

  // [AC2]
  describe('[AC2] activating the voice button never submits the form', () => {
    function innerVoiceButton(): HTMLButtonElement {
      return lastSubmitRow().querySelector('voice-record-button button') as HTMLButtonElement;
    }

    function addExpenseDispatches(): Array<unknown> {
      return expensesService.add.mock.calls;
    }

    it('should_not_dispatch_addExpense_or_call_onSubmit_on_click', () => {
      const onSubmitSpy = vi.spyOn(fixture.componentInstance as unknown as { onSubmit: (e: Event) => void }, 'onSubmit');

      innerVoiceButton().click();

      expect(onSubmitSpy).not.toHaveBeenCalled();
      expect(addExpenseDispatches()).toHaveLength(0);
    });

    it('should_not_dispatch_addExpense_or_call_onSubmit_on_pointerdown_and_pointerup', () => {
      const onSubmitSpy = vi.spyOn(fixture.componentInstance as unknown as { onSubmit: (e: Event) => void }, 'onSubmit');
      const el = innerVoiceButton();
      vi.spyOn(el, 'setPointerCapture').mockImplementation(() => undefined);

      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));

      expect(onSubmitSpy).not.toHaveBeenCalled();
      expect(addExpenseDispatches()).toHaveLength(0);
      expect(recorder.start).toHaveBeenCalledTimes(1);
      expect(recorder.stop).toHaveBeenCalledTimes(1);
    });

    it('should_not_dispatch_addExpense_or_call_onSubmit_on_space_and_enter_keydown', () => {
      const onSubmitSpy = vi.spyOn(fixture.componentInstance as unknown as { onSubmit: (e: Event) => void }, 'onSubmit');
      const el = innerVoiceButton();

      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ' ' }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));

      expect(onSubmitSpy).not.toHaveBeenCalled();
      expect(addExpenseDispatches()).toHaveLength(0);
    });
  });
});
