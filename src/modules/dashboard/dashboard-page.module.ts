import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ROUTE } from 'src/constants';
import { UIKitModule } from 'src/shared/modules';

import { isLoggedIn, isOnlineAndGapiReady } from 'src/shared/guards';
import { components } from './components';
import { CategoriesPageContainer, DashboardPageContainer, containers } from './containers';

const routes: Routes = [
  {
    path: '',
    component: DashboardPageContainer
  },
  {
    path: ROUTE.categories,
    canActivate: [isLoggedIn, isOnlineAndGapiReady],
    component: CategoriesPageContainer
  }
];

@NgModule({
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), UIKitModule],
  declarations: [...containers, ...components]
})
export class DashboardPageModule {}
