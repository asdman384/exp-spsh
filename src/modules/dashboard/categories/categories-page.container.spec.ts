import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoriesPageContainer } from './categories-page.container';
import { Store } from '@ngrx/store';
import { FormsModule } from '@angular/forms';
import { UIKitModule } from 'src/shared/modules/uikit.module';

describe('CategoriesPageContainer', () => {
  let component: CategoriesPageContainer;
  let fixture: ComponentFixture<CategoriesPageContainer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriesPageContainer, FormsModule, UIKitModule],
      providers: [{ provide: Store, useValue: { select: vi.fn(), dispatch: vi.fn() } }]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriesPageContainer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
