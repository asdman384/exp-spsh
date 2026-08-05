import { CommonModule } from '@angular/common';
import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { of, switchMap } from 'rxjs';
import { AppActions } from 'src/@state';

declare const Zone: any;

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playground.component.html',
  styleUrls: ['./playground.component.scss']
})
export class PlaygroundComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly zone = inject(NgZone);

  ngOnInit() {
    this.store.dispatch(AppActions.setTitle({ title: 'Angular Features Playground', icon: 'settings' }));
  }

  onFeatureClick(feature: string) {
    console.log(`Testing: ${feature}`);
  }

  onButtonClick() {
    const NativePromise: PromiseConstructor = (window as any)[Zone.__symbol__('Promise')] ?? Promise;

    this.zone.runOutsideAngular(() => {
      setTimeout(() => {
        new NativePromise((_, reject) => reject(new Error('нативное отклонение')));

        throw new Error('вне зоны Angular');
      });
    });

    of(null)
      .pipe(
        switchMap(() => {
          throw new Error('rxjs error');
        })
      )
      .subscribe();
  }
}
