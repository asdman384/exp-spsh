import { provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { getAppConfig } from './app/app.config';

import('./logger')
  .then(() =>
    bootstrapApplication(AppComponent, { providers: [provideZoneChangeDetection(), getAppConfig().providers] })
  )
  .catch((err) => {
    console.error(err);
    log(err);
  });
