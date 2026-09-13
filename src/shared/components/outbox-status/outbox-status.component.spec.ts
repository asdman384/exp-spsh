import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OutboxStatusComponent } from './outbox-status.component';

// [AC29] Toolbar badge presentational contract (D12).
describe('[AC29] OutboxStatusComponent', () => {
  let fixture: ComponentFixture<OutboxStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OutboxStatusComponent] }).compileComponents();
    fixture = TestBed.createComponent(OutboxStatusComponent);
  });

  function setCounts(pending: number, failed: number): void {
    fixture.componentRef.setInput('pending', pending);
    fixture.componentRef.setInput('failed', failed);
    fixture.detectChanges();
  }

  function button(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button');
  }

  it('should_render_nothing_when_pending_and_failed_are_both_zero', () => {
    setCounts(0, 0);
    expect(button()).toBeNull();
  });

  it('should_show_a_badge_whose_text_equals_pending_plus_failed', () => {
    setCounts(2, 1);
    const badge = fixture.nativeElement.querySelector('.mat-badge-content') as HTMLElement | null;
    expect(badge?.textContent?.trim()).toBe('3');
  });

  it('should_use_the_exact_aria_label_for_1_pending_0_failed', () => {
    setCounts(1, 0);
    expect(button()!.getAttribute('aria-label')).toBe('1 expense waiting to be sent. Send now');
  });

  it('should_use_the_exact_aria_label_for_3_pending_0_failed', () => {
    setCounts(3, 0);
    expect(button()!.getAttribute('aria-label')).toBe('3 expenses waiting to be sent. Send now');
  });

  it('should_use_the_exact_aria_label_for_0_pending_1_failed', () => {
    setCounts(0, 1);
    expect(button()!.getAttribute('aria-label')).toBe("1 expense couldn't be sent. Send now");
  });

  it('should_use_the_exact_aria_label_for_0_pending_2_failed', () => {
    setCounts(0, 2);
    expect(button()!.getAttribute('aria-label')).toBe("2 expenses couldn't be sent. Send now");
  });

  it('should_use_the_exact_aria_label_for_2_pending_1_failed', () => {
    setCounts(2, 1);
    expect(button()!.getAttribute('aria-label')).toBe("2 expenses waiting to be sent, 1 couldn't be sent. Send now");
  });

  it('should_mark_the_icon_as_aria_hidden', () => {
    setCounts(1, 0);
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should_emit_activate_exactly_once_per_click', () => {
    setCounts(1, 0);
    const spy = vi.fn();
    fixture.componentInstance.activate.subscribe(spy);

    button()!.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // R-3 regression (docs/reviews/write-outbox.md Required 3): the button must not carry the
  // primary theme colour, which rendered the `cloud_upload` glyph at the same #673ab7 as the
  // primary toolbar behind it (1:1 contrast). Against the pre-fix template
  // (`<button mat-icon-button color="primary" ...>`), both assertions below would fail: the
  // `color` attribute would be present and Angular Material's `mat-button-base`/`color` host
  // binding would add the `mat-primary` class. The test target's `test` builder in `angular.json`
  // has no `styles` entry (unlike the `build` target's `deeppurple-amber.css`), so the M2 theme
  // CSS is not loaded here -- a `getComputedStyle` contrast check would be meaningless in this
  // runner, so this stays an attribute/class check.
  it('should_not_carry_the_primary_theme_colour_on_the_toggle_button', () => {
    setCounts(1, 0);
    const el = button()!;

    expect(el.getAttribute('color')).toBeNull();
    expect(el.classList.contains('mat-primary')).toBe(false);
  });
});
