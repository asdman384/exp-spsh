import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatisticsContainer } from './statistics.container';

describe('StatisticsContainer', () => {
  let component: StatisticsContainer;
  let fixture: ComponentFixture<StatisticsContainer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticsContainer]
    }).compileComponents();

    fixture = TestBed.createComponent(StatisticsContainer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
