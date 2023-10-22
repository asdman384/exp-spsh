import { APP_INITIALIZER, NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { ServiceWorkerModule } from '@angular/service-worker';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SecurityService, StorageService, LocalStorageService } from 'src/services';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
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
