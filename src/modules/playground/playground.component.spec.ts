import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlaygroundComponent } from './playground.component';
import { CommonModule } from '@angular/common';

describe('PlaygroundComponent', () => {
  let component: PlaygroundComponent;
  let fixture: ComponentFixture<PlaygroundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaygroundComponent, CommonModule]
    }).compileComponents();

    fixture = TestBed.createComponent(PlaygroundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have title property', () => {
    expect(component.title).toBe('Angular Features Playground');
  });

  it('should have testFeatures array', () => {
    expect(component.testFeatures).toBeDefined();
    expect(component.testFeatures.length).toBeGreaterThan(0);
  });

  it('should render title in template', () => {
    const compiled = fixture.nativeElement.querySelector('h1');
    expect(compiled.textContent).toContain('Angular Features Playground');
  });

  it('should call onFeatureClick when feature card is clicked', () => {
    spyOn(component, 'onFeatureClick');
    const card = fixture.nativeElement.querySelector('.feature-card');
    card.click();
    expect(component.onFeatureClick).toHaveBeenCalled();
  });
});
