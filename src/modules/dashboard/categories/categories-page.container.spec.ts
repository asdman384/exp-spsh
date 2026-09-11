import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoriesPageContainer } from './categories-page.container';
import { Store } from '@ngrx/store';
import { FormsModule } from '@angular/forms';

describe('CategoriesPageContainer', () => {
  let component: CategoriesPageContainer;
  let fixture: ComponentFixture<CategoriesPageContainer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriesPageContainer, FormsModule],
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
