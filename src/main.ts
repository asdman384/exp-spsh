import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { isServiceWorkerEnabled, removeServiceWorker } from 'src/shared/helpers/service-worker-mode';
import { AppComponent } from './app/app.component';
import { getAppConfig } from './app/app.config';

// With the worker off, drop one left over from an earlier build; if it was serving this very
// page, the bundle is stale, so reload instead of bootstrapping it.
async function servedByStaleServiceWorker(): Promise<boolean> {
  if (isServiceWorkerEnabled()) {
    return false;
  }
  try {
    return await removeServiceWorker();
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function main(): Promise<void> {
  if (await servedByStaleServiceWorker()) {
    location.reload();
    return;
  }
  await import('./logger');
  const appConfig = await getAppConfig();
  await bootstrapApplication(AppComponent, { providers: [provideZonelessChangeDetection(), appConfig.providers] });
}

main().catch((err) => {
  console.error(err);
  log(err);
});
