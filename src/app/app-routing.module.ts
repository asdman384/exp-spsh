import { NgModule, inject } from '@angular/core';
import { Router, RouterModule, Routes, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';
import { ROUTE } from 'src/constants';
import { SecurityService } from 'src/services';

function isLoggedIn(): Observable<boolean | UrlTree> {
  const securityService = inject(SecurityService);
  const router = inject(Router);
  return securityService.user$.pipe(map((user) => (user ? true : router.createUrlTree(['setup']))));
}

const routes: Routes = [
  {
    path: '',
    redirectTo: ROUTE.dashboard,
    pathMatch: 'full'
  },
  {
    path: ROUTE.dashboard,
    canActivate: [isLoggedIn],
    loadChildren: () => import('src/modules/dashboard/dashboard-page.module').then((m) => m.DashboardPageModule)
  },
  {
    path: ROUTE.setup,
    loadChildren: () => import('src/modules/setup/setup-page.module').then((m) => m.SetupPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
