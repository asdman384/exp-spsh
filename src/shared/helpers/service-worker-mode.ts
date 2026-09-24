import { isDevMode } from '@angular/core';

/**
 * Whether a development build (`npm run watch`) runs the service worker. Production builds
 * always run it, whatever this says. Flip to `true` to exercise offline/update behaviour
 * locally; leave `false` so every refresh loads the freshly built assets straight from the
 * server.
 */
export const SERVICE_WORKER_IN_DEV = false;

export function isServiceWorkerEnabled(): boolean {
  return !isDevMode() || SERVICE_WORKER_IN_DEV;
}

/**
 * Removes a service worker left behind by an earlier build that had it enabled, plus the
 * ngsw caches it filled. Not registering is not enough: an already-installed worker keeps
 * controlling the page and serving its cached bundle.
 *
 * Touches only registrations and caches scoped to this app's base URL (`/exp-spsh/`), so other
 * apps on the same origin (e.g. localhost:4200) keep theirs.
 *
 * Resolves `true` when a worker was controlling the current page — the page then runs a stale
 * bundle and the caller should reload.
 */
export async function removeServiceWorker(baseUri: string = document.baseURI): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  const scope = new URL(baseUri).href;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const ours = registrations.filter((registration) => registration.scope === scope);
  await Promise.all(ours.map((registration) => registration.unregister()));

  if ('caches' in globalThis) {
    const prefix = `ngsw:${new URL(baseUri).pathname}`;
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(prefix)).map((key) => caches.delete(key)));
  }

  return ours.length > 0 && !!navigator.serviceWorker.controller;
}
