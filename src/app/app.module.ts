import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';

import { LocalStorageService, SecurityService, StorageService } from 'src/services';
import { UIKitModule } from 'src/shared/modules/uikit.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: true, // !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    }),
    UIKitModule
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
