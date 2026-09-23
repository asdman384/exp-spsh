import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { AppActions, categoriesSelector, currentSheetSelector, expensesSelector, loadingSelector, sheetsSelector } from 'src/@state';
import { VoiceRecorderOutcomeEvent, VoiceRecorderService, VoiceRecorderStatus } from 'src/services';

import { DashboardPageContainer } from './dashboard-page.container';

class FakeVoiceRecorderService {
  readonly status = signal<VoiceRecorderStatus>('idle');
  readonly latest = signal(null);
  readonly lastOutcome = signal<VoiceRecorderOutcomeEvent | null>(null);
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

describe('DashboardPageContainer', () => {
  let fixture: ComponentFixture<DashboardPageContainer>;
  let dispatchSpy: ReturnType<typeof vi.fn>;
  let recorder: FakeVoiceRecorderService;

  beforeEach(async () => {
    dispatchSpy = vi.fn();
    recorder = new FakeVoiceRecorderService();

    const selectMock = vi.fn((selector: unknown) => {
      if (selector === sheetsSelector) return of([]);
      if (selector === categoriesSelector) return of([]);
      if (selector === expensesSelector) return of([]);
      if (selector === currentSheetSelector) return of(undefined);
      if (selector === loadingSelector) return of(false);
      return of(undefined);
    });

    await TestBed.configureTestingModule({
      imports: [DashboardPageContainer],
      providers: [
        { provide: Store, useValue: { select: selectMock, dispatch: dispatchSpy } },
        { provide: VoiceRecorderService, useValue: recorder }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPageContainer);
    fixture.detectChanges();
  });

  function submitRows(): NodeListOf<HTMLElement> {
    return fixture.nativeElement.querySelectorAll('.submit-row');
  }

  function lastSubmitRow(): HTMLElement {
    const rows = submitRows();
    return rows[rows.length - 1];
  }

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
      const addExpenseType = AppActions.addExpense({ sheetId: 1, expense: {} as never }).type;
      return dispatchSpy.mock.calls.map((call) => call[0]).filter((action: { type: string }) => action?.type === addExpenseType);
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
