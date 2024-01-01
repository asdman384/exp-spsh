import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ROUTE } from 'src/constants';
import { UIKitModule } from 'src/shared/modules';

import { isLoggedIn, isOnlineAndReady } from 'src/shared/guards';
import { DashboardPageContainer, SettingsPageContainer, containers } from './containers';

const routes: Routes = [
  {
    path: '',
    component: DashboardPageContainer
  },
  {
    path: ROUTE.categories,
    canActivate: [isLoggedIn, isOnlineAndReady],
    component: SettingsPageContainer
  }
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes), UIKitModule],
  declarations: [containers]
})
export class DashboardPageModule {}
