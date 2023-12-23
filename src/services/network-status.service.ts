import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly isOnline = new BehaviorSubject(navigator.onLine);
  readonly online$: Observable<boolean> = this.isOnline.asObservable();

  constructor() {
    fromEvent(window, 'offline').subscribe(() => this.isOnline.next(false));
    fromEvent(window, 'online').subscribe(() => this.isOnline.next(true));
  }
}
