import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ROUTE } from 'src/constants';
import { UIKitModule } from 'src/shared/modules';

import { isLoggedIn, isOnline } from 'src/shared/guards';
import { components } from './components';
import { CategoriesPageContainer, DashboardPageContainer, StatisticsContainer, containers } from './containers';

const routes: Routes = [
  {
    path: '',
    component: DashboardPageContainer
  },
  {
    path: ROUTE.categories,
    canActivate: [isLoggedIn, isOnline],
    component: CategoriesPageContainer
  },
  {
    path: ROUTE.stats,
    canActivate: [isLoggedIn, isOnline],
    canDeactivate: [
      (component: StatisticsContainer) => {
        component.tableAnimation('none');
        return true;
      }
    ],
    component: StatisticsContainer
  }
];

@NgModule({
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), UIKitModule],
  declarations: [...containers, ...components]
})
export class DashboardPageModule {}
