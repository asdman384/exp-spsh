import { CommonModule } from '@angular/common';
import { NgModule, inject } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { map } from 'rxjs';

import { ROUTE } from 'src/constants';
import { SecurityService } from 'src/services';
import { UIKitModule } from 'src/shared/modules';

import { LoginPageContainer } from './containers/login-page.containers';
import { SettingsPageContainer } from './containers/settings-page.containers';

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
    canActivate: [() => inject(SecurityService).user$.pipe(map((user) => !!user))],
    component: SettingsPageContainer
  }
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes), UIKitModule],
  exports: [],
  declarations: [LoginPageContainer, SettingsPageContainer],
  providers: []
})
export class SetupPageModule {}
