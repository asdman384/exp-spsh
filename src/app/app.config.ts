import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withJsonpSupport } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, ImportProvidersSource } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { ServiceWorkerModule } from '@angular/service-worker';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { metaReducers, reducers } from 'src/@state';
import { AppEffects } from 'src/@state/app.effects';
import { ExpAuthInterceptor } from 'src/http-interceptors';
import { AbstractSecurityService, LocalStorageService, RedirectSecurityService, StorageService } from 'src/services';
import { routes } from './app.routes';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

const debug: ImportProvidersSource[] = [];
const search = window.location.href.split('?')[1];
const urlParams = new URLSearchParams(search);
const loggerType = urlParams.get('logger');
if (loggerType) {
  debug.push(
    StoreDevtoolsModule.instrument({
      maxAge: 25, // Retains last 25 states
      logOnly: false, // Restrict extension to log-only mode
      autoPause: false, // Pauses recording actions and state changes when the extension window is not open
      trace: false, //  If set to true, will include stack trace for every dispatched action, so you can see it in trace tab jumping directly to that part of code
      traceLimit: 75, // maximum stack trace frames to be stored (in case trace option was provided as true)
      connectInZone: false // If set to true, the connection is established within the Angular zone
    })
  );
}

export function getAppConfig(): ApplicationConfig {
  return {
    providers: [
      withViewTransitions({
        onViewTransitionCreated: (event) => {
          // playing around with view transitions
          // https://blog.angular.io/check-out-angulars-support-for-the-view-transitions-api-3937376cfc19
          // https://developer.chrome.com/docs/web-platform/view-transitions/
          // console.log('onViewTransitionCreated', event);
        }
      }).ɵproviders,
      provideRouter(routes, withComponentInputBinding()),
      { provide: AbstractSecurityService, useClass: RedirectSecurityService },
      { provide: HTTP_INTERCEPTORS, useClass: ExpAuthInterceptor, multi: true },
      { provide: LocationStrategy, useClass: HashLocationStrategy },
      { provide: StorageService, useClass: LocalStorageService },
      provideHttpClient(withInterceptorsFromDi(), withJsonpSupport()),
      importProvidersFrom([
        BrowserModule,
        ServiceWorkerModule.register('ngsw-worker.js', {
          enabled: true, // !isDevMode(),
          // Register the ServiceWorker as soon as the application is stable
          // or after 30 seconds (whichever comes first).
          registrationStrategy: 'registerWhenStable:30000'
        }),
        StoreModule.forRoot(reducers, { metaReducers }),
        EffectsModule.forRoot(AppEffects),
        ...debug
      ])
    ]
  };
}
