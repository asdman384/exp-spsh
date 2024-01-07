import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ROUTE } from 'src/constants';
import { isLoggedIn } from 'src/shared/guards';
import { UIKitModule } from 'src/shared/modules';

import { LoginPageContainer } from './containers/login-page.containers';
import { SettingsPageContainer } from './containers/setup-page/setup-page.container';

const routes: Routes = [
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

@NgModule({
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), UIKitModule],
  exports: [],
  declarations: [LoginPageContainer, SettingsPageContainer],
  providers: []
})
export class SetupPageModule {}
