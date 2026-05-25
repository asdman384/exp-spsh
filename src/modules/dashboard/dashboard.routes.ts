import { Routes } from '@angular/router';
import { ROUTE } from 'src/constants';
import { isLoggedIn, isOnline } from 'src/shared/guards';
import { CategoriesPageContainer } from './categories/categories-page.container';
import { DashboardPageContainer } from './dashboard/dashboard-page.container';
import { StatisticsContainer } from './statistics/statistics.container';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
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
