import { CommonModule } from '@angular/common';
import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, debounceTime, delay, distinctUntilChanged, map, Observable, of, OperatorFunction, pipe, retry, startWith, Subject, switchMap, timer } from 'rxjs';
import { AppActions } from 'src/@state';

declare const Zone: any;


interface State<T> {
  items: T[];
  loading: boolean;
  error: string | null;
}

export function searchQuery<T>(
  fetch: (q: string) => Observable<T[]>
): OperatorFunction<string, State<T>> {
  return pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(q => fetch(q).pipe(
      map(items => ({ items, loading: false, error: null })),
      startWith({ items: [], loading: true, error: null }),
      catchError(e => of({ items: [], loading: false, error: 'error' })),
    )),
  );
}


export function retryWithBackoff<T>(max = 3) {
  return (source: Observable<T>) => source.pipe(
    retry({ count: max, delay: (_e, i) => timer(2 ** i * 300) })
  );
}

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

  private readonly obs = new Subject<string>();

  private readonly test$ = this.obs.pipe(
    searchQuery(fetchData),
    (source: Observable<any>) => source.pipe(
      retry({ count: 1, delay: (_e, i) => timer(2 ** i * 300) })
    )
  );

  ngOnInit() {
    this.store.dispatch(AppActions.setTitle({ title: 'Angular Features Playground', icon: 'settings' }));


    this.test$.subscribe({
      next: (state) => {
        console.log('State:', state);
      }
    })
  }

  onFeatureClick(feature: string) {
    console.log(`Testing: ${feature}`);
  }

  onButtonClick() {
    this.obs.next('test');
  }
}

function fetchData(query: string): Observable<string[]> {
  // Simulate an API call - replace this with your actual data fetching logic
  return of([`Result for: ${query}`]).pipe(delay(500)); // Simulate network delay
}