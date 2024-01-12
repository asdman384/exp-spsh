import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpDialogComponent } from './dialog.component';

describe('DialogComponent', () => {
  let component: ExpDialogComponent;
  let fixture: ComponentFixture<ExpDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ExpDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
