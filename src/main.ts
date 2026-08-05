import { provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { getAppConfig } from './app/app.config';

window.addEventListener('unhandledrejection', (event) => {
  // event.preventDefault(); // убрать красный лог в консоли
  console.log('Unhandled promise rejection:', event.reason); // асинхронные ошибки — отдельное событие
});

window.addEventListener('error', (event) => {
  console.log('Synchronous error occurred:', event.error); // синхронные ошибки — отдельное событие
});

import('./logger')
  .then(() =>
    bootstrapApplication(AppComponent, { providers: [provideZoneChangeDetection(), getAppConfig().providers] })
  )
  .catch((err) => {
    console.error(err);
    log(err);
  });
