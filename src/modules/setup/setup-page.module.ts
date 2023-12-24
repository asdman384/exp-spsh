import { CommonModule } from '@angular/common';
import { NgModule, inject } from '@angular/core';
import { UIKitModule } from '../../shared/modules/uikit.module';
import { LoginPageContainer } from './containers/login-page.containers';
import { RouterModule, Routes } from '@angular/router';
import { SettingsPageContainer } from './containers/settings-page.containers';
import { SecurityService } from 'src/services';
import { map } from 'rxjs';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginPageContainer
  },
  {
    path: 'settings',
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
