import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTE } from 'src/constants';
import { isLoggedIn } from 'src/shared/guards';

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
