import { Routes } from '@angular/router';
import { ROUTE } from 'src/constants';
import { isLoggedIn } from 'src/shared/guards';
import { LoginPageContainer } from './login-page.containers';
import { SettingsPageContainer } from './setup-page/setup-page.container';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: ROUTE.login,
    component: LoginPageContainer
  },
  {
    path: ROUTE.settings,
    canActivate: [isLoggedIn],
    component: SettingsPageContainer
  }
];
