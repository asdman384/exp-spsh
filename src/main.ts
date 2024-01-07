import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

import('./logger')
  .then(() => platformBrowserDynamic().bootstrapModule(AppModule))
  .catch((err) => {
    console.error(err);
    log(err);
  });
