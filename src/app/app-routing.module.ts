import { NgModule } from '@angular/core';
import { provideRouter, RouterModule, Routes, withViewTransitions } from '@angular/router';
import { ROUTE } from 'src/constants';
import { isLoggedIn, isSetupReady } from 'src/shared/guards';

const routes: Routes = [
  {
    path: '',
    redirectTo: ROUTE.dashboard,
    pathMatch: 'full'
  },
  {
    path: ROUTE.dashboard,
    canActivate: [isLoggedIn, isSetupReady],
    loadChildren: () => import('src/modules/dashboard/dashboard-page.module').then((m) => m.DashboardPageModule)
  },
  {
    path: ROUTE.setup,
    loadChildren: () => import('src/modules/setup/setup-page.module').then((m) => m.SetupPageModule)
  }
];

@NgModule({
  providers: [
    withViewTransitions({
      onViewTransitionCreated: (event) => {
        // playing around with view transitions
        // https://blog.angular.io/check-out-angulars-support-for-the-view-transitions-api-3937376cfc19
        // https://developer.chrome.com/docs/web-platform/view-transitions/
        console.log('onViewTransitionCreated', event);
      }
    }).ɵproviders,
    provideRouter(routes, withViewTransitions())
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
