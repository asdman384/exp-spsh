import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoriesPageContainer } from './categories-page.container';
import { Store } from '@ngrx/store';
import { FormsModule } from '@angular/forms';
import { UIKitModule } from 'src/shared/modules/uikit.module';


describe('SettingsPageContainer', () => {
  let component: CategoriesPageContainer;
  let fixture: ComponentFixture<CategoriesPageContainer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, UIKitModule], // Import necessary modules
      declarations: [CategoriesPageContainer],
      providers: [
        { provide: Store, useValue: { select: jasmine.createSpy('select'), dispatch: jasmine.createSpy('dispatch') } } // Provide a mock Store with select and dispatch
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriesPageContainer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
