import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { APP_INITIALIZER, NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';

import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

import { HttpClientModule } from '@angular/common/http';
import { AppEffects, metaReducers, reducers } from 'src/@state';
import { LocalStorageService, SecurityService, StorageService } from 'src/services';
import { UIKitModule } from 'src/shared/modules/uikit.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: true, // !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    }),
    UIKitModule,
    StoreModule.forRoot(reducers, { metaReducers }),
    // StoreDevtoolsModule.instrument({
    //   maxAge: 25, // Retains last 25 states
    //   logOnly: !isDevMode(), // Restrict extension to log-only mode
    //   autoPause: false, // Pauses recording actions and state changes when the extension window is not open
    //   trace: false, //  If set to true, will include stack trace for every dispatched action, so you can see it in trace tab jumping directly to that part of code
    //   traceLimit: 75, // maximum stack trace frames to be stored (in case trace option was provided as true)
    //   connectInZone: false // If set to true, the connection is established within the Angular zone
    // }),
    EffectsModule.forRoot(AppEffects)
  ],
  providers: [
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    SecurityService,
    { provide: StorageService, useClass: LocalStorageService },
    {
      provide: APP_INITIALIZER,
      useFactory: (securityService: SecurityService) => {
        return () => securityService.init();
      },
      deps: [SecurityService],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
