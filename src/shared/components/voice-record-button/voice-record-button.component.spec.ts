import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { signal } from '@angular/core';

import { VoiceRecorderOutcomeEvent, VoiceRecorderService, VoiceRecorderStatus } from 'src/services';

import { VoiceRecordButtonComponent } from './voice-record-button.component';

class FakeVoiceRecorderService {
  readonly status = signal<VoiceRecorderStatus>('idle');
  readonly latest = signal(null);
  readonly lastOutcome = signal<VoiceRecorderOutcomeEvent | null>(null);
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

describe('VoiceRecordButtonComponent', () => {
  let fixture: ComponentFixture<VoiceRecordButtonComponent>;
  let recorder: FakeVoiceRecorderService;
  let announceSpy: ReturnType<typeof vi.fn>;
  let outcomeCounter: number;

  beforeEach(async () => {
    recorder = new FakeVoiceRecorderService();
    announceSpy = vi.fn().mockResolvedValue(undefined);
    outcomeCounter = 0;

    await TestBed.configureTestingModule({
      imports: [VoiceRecordButtonComponent],
      providers: [
        { provide: VoiceRecorderService, useValue: recorder },
        { provide: LiveAnnouncer, useValue: { announce: announceSpy } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VoiceRecordButtonComponent);
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  function reportOutcome(outcome: VoiceRecorderOutcomeEvent['outcome']): void {
    outcomeCounter++;
    recorder.lastOutcome.set({ outcome, at: outcomeCounter });
  }

  function pointerDown(overrides: Partial<PointerEventInit> = {}): PointerEvent {
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, ...overrides });
    button().dispatchEvent(event);
    return event;
  }

  function keyDown(key: string, overrides: Partial<KeyboardEventInit> = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...overrides });
    button().dispatchEvent(event);
    return event;
  }

  function keyUp(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key });
    button().dispatchEvent(event);
    return event;
  }

  // [AC16]
  describe('[AC16] pointer hold gesture', () => {
    it('should_call_setpointercapture_and_start_on_a_primary_pointerdown', () => {
      const captureSpy = vi.spyOn(button(), 'setPointerCapture').mockImplementation(() => undefined);

      pointerDown({ button: 0 });

      expect(captureSpy).toHaveBeenCalledWith(1);
      expect(recorder.start).toHaveBeenCalledTimes(1);
    });

    it('should_not_start_on_a_non_primary_pointerdown', () => {
      vi.spyOn(button(), 'setPointerCapture').mockImplementation(() => undefined);

      pointerDown({ button: 2 });

      expect(recorder.start).not.toHaveBeenCalled();
    });

    it('should_call_stop_on_pointerup', () => {
      vi.spyOn(button(), 'setPointerCapture').mockImplementation(() => undefined);
      pointerDown();

      button().dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));

      expect(recorder.stop).toHaveBeenCalledTimes(1);
    });

    it('should_call_stop_on_pointercancel', () => {
      vi.spyOn(button(), 'setPointerCapture').mockImplementation(() => undefined);
      pointerDown();

      button().dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));

      expect(recorder.stop).toHaveBeenCalledTimes(1);
    });

    it('should_call_stop_on_lostpointercapture', () => {
      vi.spyOn(button(), 'setPointerCapture').mockImplementation(() => undefined);
      pointerDown();

      button().dispatchEvent(new Event('lostpointercapture', { bubbles: true }));

      expect(recorder.stop).toHaveBeenCalledTimes(1);
    });
  });

  // [AC17]
  describe('[AC17] pointerleave', () => {
    it('should_not_call_stop_on_pointerleave_alone', () => {
      vi.spyOn(button(), 'setPointerCapture').mockImplementation(() => undefined);
      pointerDown();
      recorder.stop.mockClear();

      button().dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, pointerId: 1 }));

      expect(recorder.stop).not.toHaveBeenCalled();
    });
  });

  // [AC18]
  describe('[AC18] keyboard hold gesture', () => {
    it('should_call_start_and_preventdefault_on_a_non_repeat_space_keydown', () => {
      const event = keyDown(' ', { repeat: false });

      expect(recorder.start).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('should_call_start_and_preventdefault_on_a_non_repeat_enter_keydown', () => {
      const event = keyDown('Enter', { repeat: false });

      expect(recorder.start).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('should_not_call_start_again_on_a_repeat_keydown', () => {
      keyDown(' ', { repeat: false });
      recorder.start.mockClear();

      keyDown(' ', { repeat: true });

      expect(recorder.start).not.toHaveBeenCalled();
    });

    it('should_call_stop_on_keyup_of_the_same_key', () => {
      keyDown(' ', { repeat: false });

      keyUp(' ');

      expect(recorder.stop).toHaveBeenCalledTimes(1);
    });

    it('should_call_stop_on_blur_while_recording', () => {
      keyDown(' ', { repeat: false });
      recorder.status.set('recording');

      button().dispatchEvent(new Event('blur', { bubbles: true }));

      expect(recorder.stop).toHaveBeenCalledTimes(1);
    });
  });

  // [AC19]
  describe('[AC19] contextmenu suppression', () => {
    it('should_preventdefault_a_contextmenu_event', () => {
      const event = new Event('contextmenu', { bubbles: true, cancelable: true });

      button().dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  // [AC20]
  describe('[AC20] recording indicator', () => {
    it('should_show_the_recording_class_mic_icon_and_aria_pressed_true_while_recording', () => {
      recorder.status.set('recording');
      fixture.detectChanges();

      const el = button();
      expect(el.classList.contains('recording')).toBe(true);
      expect(el.getAttribute('aria-pressed')).toBe('true');
      expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('mic');
    });

    it('should_show_mic_none_no_recording_class_and_aria_pressed_false_while_idle', () => {
      recorder.status.set('idle');
      fixture.detectChanges();

      const el = button();
      expect(el.classList.contains('recording')).toBe(false);
      expect(el.getAttribute('aria-pressed')).toBe('false');
      expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('mic_none');
    });
  });

  // [AC21]
  describe('[AC21] LiveAnnouncer messages', () => {
    const cases: Array<[VoiceRecorderOutcomeEvent['outcome'], string]> = [
      ['permission-granted', 'Microphone ready. Press and hold to record'],
      ['started', 'Recording'],
      ['saved', 'Recording stopped'],
      ['limit-reached', 'Recording stopped, 60 second limit reached'],
      ['too-short', 'Recording too short, discarded'],
      ['denied', 'Microphone permission denied'],
      ['unsupported', 'Microphone unavailable'],
      ['no-device', 'Microphone unavailable'],
      ['failed', 'Microphone unavailable']
    ];

    for (const [outcome, message] of cases) {
      it(`should_announce_politely_for_${outcome}`, () => {
        reportOutcome(outcome);
        TestBed.tick();

        expect(announceSpy).toHaveBeenCalledWith(message, 'polite');
      });
    }
  });

  // [AC22]
  describe('[AC22] destroy while recording', () => {
    it('should_call_stop_exactly_once_on_destroy_and_throw_nothing_afterwards', () => {
      recorder.status.set('recording');
      fixture.detectChanges();

      expect(() => fixture.destroy()).not.toThrow();

      expect(recorder.stop).toHaveBeenCalledTimes(1);
    });
  });

  // [AC30]
  describe('[AC30] requesting/starting look idle but busy', () => {
    it('should_look_idle_with_aria_busy_true_while_requesting', () => {
      recorder.status.set('requesting');
      fixture.detectChanges();

      const el = button();
      expect(el.classList.contains('recording')).toBe(false);
      expect(el.getAttribute('aria-pressed')).toBe('false');
      expect(el.getAttribute('aria-busy')).toBe('true');
      expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('mic_none');
    });

    it('should_look_idle_with_aria_busy_true_while_starting', () => {
      recorder.status.set('starting');
      fixture.detectChanges();

      const el = button();
      expect(el.classList.contains('recording')).toBe(false);
      expect(el.getAttribute('aria-pressed')).toBe('false');
      expect(el.getAttribute('aria-busy')).toBe('true');
    });

    it('should_have_aria_busy_false_while_idle', () => {
      recorder.status.set('idle');
      fixture.detectChanges();

      expect(button().getAttribute('aria-busy')).toBe('false');
    });
  });
});
