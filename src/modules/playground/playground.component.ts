import { CommonModule } from '@angular/common';
import { Component, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, combineLatest, debounceTime, defer, delay, distinctUntilChanged, map, Observable, of, OperatorFunction, pipe, retry, startWith, Subject, Subscription, switchMap, timer } from 'rxjs';
import { AppActions } from 'src/@state';
import { TestPerfComponent } from './test-perf/test-perf.component';

interface State<T> {
  items: T[];
  loading: boolean;
  error: string | null;
}

export function searchQuery<T>(
  fetch: (q: string, filter2: string) => Observable<T[]>
): OperatorFunction<[string, string], State<T>> {
  return pipe(
    debounceTime(300),
    distinctUntilChanged(([oldQ, oldFilter2], [q, filter2]) => q === oldQ && filter2 === oldFilter2),
    switchMap(([q, filter2]) => defer(() => fetch(q, filter2)).pipe(
      map(items => ({ items, loading: false, error: null })),
      startWith({ items: [], loading: true, error: null }),
      catchError(() => of<State<T>>({ items: [], loading: false, error: 'error for ' + q })),
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
  imports: [CommonModule, TestPerfComponent],
  templateUrl: './playground.component.html',
  styleUrls: ['./playground.component.scss']
})
export class PlaygroundComponent implements OnInit {
  private readonly store = inject(Store);

  protected items = signal<number[]>(Array.from({ length: 0 }, () => 1));

  private readonly filter1$ = new Subject<string>();
  private readonly filter2$ = new Subject<string>();

  protected readonly output$ =
    combineLatest([this.filter1$, this.filter2$]).pipe(
      searchQuery(fetchData),
      // (source: Observable<State<string>>) => source.pipe(
      //   retry({ count: 1, delay: (_e, i) => timer(2 ** i * 300) })
      // )
    );

  // Signal-based counterpart of output$ (Angular 18 APIs only: signal + effect).
  // The effect restarts the 300ms timer on every filter change (debounceTime); runSearch skips
  // an unchanged pair (distinctUntilChanged) and drops the in-flight request (switchMap).
  // All signal writes happen in timer/subscription callbacks, outside the effect's reactive
  // context, so the effect needs no allowSignalWrites.
  private readonly filter1 = signal<string>('');
  private readonly filter2 = signal<string>('');
  private readonly signalState = signal<State<string>>({ items: [], loading: false, error: null });
  protected readonly output = this.signalState.asReadonly();

  private lastFilters: [string, string] | null = null;
  private searchSubscription: Subscription | null = null;

  private readonly debounceFilters = effect((onCleanup) => {
    const q = this.filter1();
    const filter2 = this.filter2();
    const timeoutId = setTimeout(() => this.runSearch(q, filter2), 300);
    onCleanup(() => clearTimeout(timeoutId));
  });

  private readonly cancelSearchOnDestroy = inject(DestroyRef).onDestroy(() => this.searchSubscription?.unsubscribe());

  private readonly logOutput = effect(() => console.log('Signal state:', this.output()));

  ngOnInit() {
    this.store.dispatch(AppActions.setTitle({ title: 'Angular Features Playground', icon: 'settings' }));


    this.output$.subscribe({
      next: (state) => {
        console.log('State:', state);
      }
    })
  }

  onStartClick() {
    this.items.set(Array.from({ length: 1 }, () => 1));
  }

  onFeatureClick(feature: string) {
    console.log(`Testing: ${feature}`);
  }

  i = 2;
  onButtonClick() {
    this.filter1$.next('test' + this.i++);
  }

  filter1Change(event: Event) {
    const input = event.target as HTMLInputElement;
    this.filter1$.next(input.value);
  }

  filter2Change(event: Event) {
    const input = event.target as HTMLInputElement;
    this.filter2$.next(input.value);
  }

  private runSearch(q: string, filter2: string) {
    if (this.lastFilters && this.lastFilters[0] === q && this.lastFilters[1] === filter2) {
      return;
    }
    this.lastFilters = [q, filter2];

    this.searchSubscription?.unsubscribe();
    this.signalState.set({ items: [], loading: true, error: null });
    this.searchSubscription = defer(() => fetchData(q, filter2)).subscribe({
      next: items => this.signalState.set({ items, loading: false, error: null }),
      error: () => this.signalState.set({ items: [], loading: false, error: 'error for ' + q }),
    });
  }

  j = 2;
  onSignalButtonClick() {
    this.filter1.set('test' + this.j++);
  }

  filter1SignalChange(event: Event) {
    this.filter1.set((event.target as HTMLInputElement).value);
  }

  filter2SignalChange(event: Event) {
    this.filter2.set((event.target as HTMLInputElement).value);
  }
}

function fetchData(query: string, filter2: string): Observable<string[]> {
  if (query === 'test3') {
    throw new Error('Simulated error for query: ' + query);
  }
  // Simulate an API call - replace this with your actual data fetching logic
  return of([`Result for: ${query} and filter2: ${filter2}`]).pipe(delay(500)); // Simulate network delay
}