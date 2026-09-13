import 'src/logger';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';

import { OutboxDrainLock } from './outbox-drain-lock.service';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: timed out');
    }
    await wait(5);
  }
}

// [AC11] Real Web Locks in headless Chromium: non-overlap, release on error, and the unlocked
// fallback.
describe('[AC11] OutboxDrainLock against real Web Locks', () => {
  it('should_not_start_the_second_runs_work_until_the_first_runs_work_completes', async () => {
    const lock = new OutboxDrainLock();
    const events: Array<string> = [];
    let resolveFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const first$ = lock.run(
      () =>
        new Observable<void>((subscriber) => {
          events.push('first-start');
          void firstGate.then(() => {
            events.push('first-end');
            subscriber.next();
            subscriber.complete();
          });
        })
    );
    const firstDone = firstValueFrom(first$);

    await waitFor(() => events.includes('first-start'));

    const second$ = lock.run(
      () =>
        new Observable<void>((subscriber) => {
          events.push('second-start');
          subscriber.next();
          subscriber.complete();
        })
    );
    const secondDone = firstValueFrom(second$);

    // Give the second `run` every chance to (wrongly) start while the first is still holding
    // the lock.
    await wait(100);
    expect(events).toEqual(['first-start']);

    resolveFirst();
    await Promise.all([firstDone, secondDone]);

    expect(events).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('should_release_the_lock_when_the_work_errors_so_a_later_run_can_acquire_it', async () => {
    const lock = new OutboxDrainLock();

    await expect(firstValueFrom(lock.run(() => throwError(() => new Error('boom'))))).rejects.toThrow('boom');

    let secondRan = false;
    await firstValueFrom(
      lock.run(() => {
        secondRan = true;
        return of(undefined);
      })
    );

    expect(secondRan).toBe(true);
  });

  it('should_run_unlocked_and_log_once_when_navigator_locks_is_unavailable', async () => {
    const logSpy = vi.fn();
    const originalLog = (globalThis as unknown as { log: (...args: unknown[]) => void }).log;
    (globalThis as unknown as { log: (...args: unknown[]) => void }).log = logSpy;
    const locksSpy = vi.spyOn(navigator, 'locks', 'get').mockReturnValue(undefined as unknown as LockManager);

    try {
      const lock = new OutboxDrainLock();
      let ranCount = 0;

      await firstValueFrom(
        lock.run(() => {
          ranCount++;
          return of('a');
        })
      );
      await firstValueFrom(
        lock.run(() => {
          ranCount++;
          return of('b');
        })
      );

      expect(ranCount).toBe(2); // fallback runs the work directly, unlocked
      expect(logSpy).toHaveBeenCalledTimes(1); // logs once per session, not once per call
    } finally {
      locksSpy.mockRestore();
      (globalThis as unknown as { log: (...args: unknown[]) => void }).log = originalLog;
    }
  });
});
