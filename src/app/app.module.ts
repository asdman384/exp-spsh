import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClientJsonpModule, HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';

import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

import { AppEffects, metaReducers, reducers } from 'src/@state';
import { ExpAuthInterceptor } from 'src/http-interceptors';
import { AbstractSecurityService, LocalStorageService, RedirectSecurityService, StorageService } from 'src/services';
import { UIKitModule } from 'src/shared/modules/uikit.module';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

const debug = [];
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

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    HttpClientJsonpModule,
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: true, // !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    }),
    UIKitModule,
    StoreModule.forRoot(reducers, { metaReducers }),
    EffectsModule.forRoot(AppEffects),
    ...debug
  ],
  providers: [
    { provide: AbstractSecurityService, useClass: RedirectSecurityService },
    { provide: HTTP_INTERCEPTORS, useClass: ExpAuthInterceptor, multi: true },
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    { provide: StorageService, useClass: LocalStorageService }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
