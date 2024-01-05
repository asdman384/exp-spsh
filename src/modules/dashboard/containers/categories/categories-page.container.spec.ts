import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoriesPageContainer } from './categories-page.container';

describe('SettingsPageContainer', () => {
  let component: CategoriesPageContainer;
  let fixture: ComponentFixture<CategoriesPageContainer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriesPageContainer]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriesPageContainer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
