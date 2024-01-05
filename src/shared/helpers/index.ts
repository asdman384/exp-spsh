import { NgZone } from '@angular/core';
import { Observable } from 'rxjs';

export function nonZonePromiseToObservable<T>(promise: Promise<T>, zone: NgZone): Observable<T> {
  return new Observable<T>((subscriber) => {
    promise
      .then((v) => {
        zone.run(() => {
          subscriber.next(v);
          subscriber.complete();
        });
      })
      .catch((error) => zone.run(() => subscriber.error(error)));
  });
}
