import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatisticsContainer } from './statistics.container';
import { UIKitModule } from 'src/shared/modules/uikit.module';

describe('StatisticsContainer', () => {
    let component: StatisticsContainer;
    let fixture: ComponentFixture<StatisticsContainer>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CommonModule, UIKitModule],
            declarations: [StatisticsContainer]
        }).compileComponents();

        fixture = TestBed.createComponent(StatisticsContainer);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
