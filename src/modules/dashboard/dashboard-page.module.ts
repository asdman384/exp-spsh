import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ROUTE } from 'src/constants';
import { UIKitModule } from 'src/shared/modules';

import { isLoggedIn, isOnlineAndReady } from 'src/shared/guards';
import { components } from './components';
import { CategoriesPageContainer, DashboardPageContainer, containers } from './containers';

const routes: Routes = [
  {
    path: '',
    component: DashboardPageContainer
  },
  {
    path: ROUTE.categories,
    canActivate: [isLoggedIn, isOnlineAndReady],
    component: CategoriesPageContainer
  }
];

@NgModule({
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), UIKitModule],
  declarations: [...containers, ...components]
})
export class DashboardPageModule {}
