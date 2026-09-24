import { isServiceWorkerEnabled, removeServiceWorker, SERVICE_WORKER_IN_DEV } from './service-worker-mode';

const BASE = 'http://localhost:4200/exp-spsh/';

function registration(scope: string): ServiceWorkerRegistration {
  return { scope, unregister: vi.fn().mockResolvedValue(true) } as unknown as ServiceWorkerRegistration;
}

describe('service-worker-mode', () => {
  afterEach(() => vi.restoreAllMocks());

  it('isServiceWorkerEnabled follows SERVICE_WORKER_IN_DEV in a dev-mode build', () => {
    expect(isServiceWorkerEnabled()).toBe(SERVICE_WORKER_IN_DEV);
  });

  it('removeServiceWorker unregisters only the registration scoped to the base URL', async () => {
    const ours = registration(BASE);
    const other = registration('http://localhost:4200/other/');
    vi.spyOn(navigator.serviceWorker, 'getRegistrations').mockResolvedValue([ours, other]);
    vi.spyOn(caches, 'keys').mockResolvedValue([]);

    await removeServiceWorker(BASE);

    expect(ours.unregister).toHaveBeenCalled();
    expect(other.unregister).not.toHaveBeenCalled();
  });

  it('removeServiceWorker deletes only the ngsw caches under the base path', async () => {
    vi.spyOn(navigator.serviceWorker, 'getRegistrations').mockResolvedValue([]);
    vi.spyOn(caches, 'keys').mockResolvedValue(['ngsw:/exp-spsh/:db:control', 'ngsw:/other/:db:control', 'unrelated']);
    const del = vi.spyOn(caches, 'delete').mockResolvedValue(true);

    await removeServiceWorker(BASE);

    expect(del.mock.calls).toEqual([['ngsw:/exp-spsh/:db:control']]);
  });

  it('removeServiceWorker reports no reload needed when nothing was registered', async () => {
    vi.spyOn(navigator.serviceWorker, 'getRegistrations').mockResolvedValue([]);
    vi.spyOn(caches, 'keys').mockResolvedValue([]);

    await expect(removeServiceWorker(BASE)).resolves.toBe(false);
  });
});
