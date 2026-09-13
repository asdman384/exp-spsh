import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const LOCK_NAME = 'exp-spsh-outbox-drain';

/**
 * Wraps the Web Locks API so at most one tab runs a drain pass at a time (D8 of
 * `docs/specs/write-outbox.md`). Falls back to running the work unlocked -- and logging once per
 * session -- when `navigator.locks` is unavailable.
 */
@Injectable({ providedIn: 'root' })
export class OutboxDrainLock {
  private loggedFallback = false;

  run<T>(work: () => Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      let cancelled = false;

      const runWork = (): Promise<void> =>
        new Promise<void>((resolveWork) => {
          try {
            work().subscribe({
              next: (value) => subscriber.next(value),
              error: (e: unknown) => {
                subscriber.error(e);
                resolveWork();
              },
              complete: () => {
                subscriber.complete();
                resolveWork();
              }
            });
          } catch (e) {
            subscriber.error(e);
            resolveWork();
          }
        });

      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      if (!locks) {
        if (!this.loggedFallback) {
          this.loggedFallback = true;
          log('OutboxDrainLock: Web Locks API unavailable; running the drain pass without a lock.');
        }
        void runWork();
        return;
      }

      locks.request(LOCK_NAME, () => runWork()).catch((e: unknown) => {
        if (!cancelled) {
          subscriber.error(e);
        }
      });

      return () => {
        cancelled = true;
      };
    });
  }
}
