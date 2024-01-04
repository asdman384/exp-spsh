import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ROUTE } from 'src/constants';
import { UIKitModule } from 'src/shared/modules';

import { isLoggedIn, isOnlineAndReady } from 'src/shared/guards';
import { DashboardPageContainer, SettingsPageContainer, containers } from './containers';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

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
  imports: [CommonModule, FormsModule, StoreModule, EffectsModule, RouterModule.forChild(routes), UIKitModule],
  declarations: [containers]
})
export class DashboardPageModule {}
