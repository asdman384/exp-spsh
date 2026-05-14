import { provideZoneChangeDetection } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';

import('./logger')
  .then(() => platformBrowser().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()] }))
  .catch((err) => {
    console.error(err);
    log(err);
  });
