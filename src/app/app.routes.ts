import { Routes } from '@angular/router';
import { ROUTE } from 'src/constants';
import { isLoggedIn, isSetupReady } from 'src/shared/guards';

export const routes: Routes = [
  {
    path: '',
    redirectTo: ROUTE.dashboard,
    pathMatch: 'full'
  },
  {
    path: ROUTE.dashboard,
    canActivate: [isLoggedIn, isSetupReady],
    loadComponent: () => import('src/modules/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    loadChildren: () => import('src/modules/dashboard/dashboard.routes').then((m) => m.routes)
  },
  {
    path: ROUTE.setup,
    loadComponent: () => import('src/modules/setup/setup.component').then((m) => m.SetupComponent),
    loadChildren: () => import('src/modules/setup/setup.routes').then((m) => m.routes)
  },
  {
    path: ROUTE.playground,
    loadComponent: () => import('src/modules/playground/playground.component').then((m) => m.PlaygroundComponent),
    loadChildren: () => import('src/modules/playground/playground.routes').then((m) => m.routes)
  }
];
