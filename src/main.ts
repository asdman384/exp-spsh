import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { getAppConfig } from './app/app.config';

import('./logger')
  .then(() => getAppConfig())
  .then((appConfig) =>
    bootstrapApplication(AppComponent, { providers: [provideZonelessChangeDetection(), appConfig.providers] })
  )
  .catch((err) => {
    console.error(err);
    log(err);
  });
