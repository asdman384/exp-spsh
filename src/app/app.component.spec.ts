import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { UIKitModule } from 'src/shared/modules/uikit.module';
import { AppComponent } from './app.component';
import { metaReducers, reducers } from 'src/@state/app.reducers';
import { StoreModule } from '@ngrx/store';

describe.skip('AppComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [AppComponent, CommonModule, UIKitModule, StoreModule.forRoot(reducers, { metaReducers })]
    })
  );

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.content span')?.textContent).toContain('exp-spsh app is running!');
  });
});
