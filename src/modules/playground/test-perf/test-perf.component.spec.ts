import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestPerfComponent } from './test-perf.component';

describe('TestPerfComponent', () => {
  let component: TestPerfComponent;
  let fixture: ComponentFixture<TestPerfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestPerfComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestPerfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
