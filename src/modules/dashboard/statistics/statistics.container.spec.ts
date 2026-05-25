import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatisticsContainer } from './statistics.container';
import { UIKitModule } from 'src/shared/modules/uikit.module';
import { FormsModule } from '@angular/forms';
import { StoreModule } from '@ngrx/store';
import { metaReducers, reducers } from 'src/@state/app.reducers';

describe('StatisticsContainer', () => {
  let component: StatisticsContainer;
  let fixture: ComponentFixture<StatisticsContainer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, StatisticsContainer, UIKitModule, StoreModule.forRoot(reducers, { metaReducers })]
    }).compileComponents();

    fixture = TestBed.createComponent(StatisticsContainer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
