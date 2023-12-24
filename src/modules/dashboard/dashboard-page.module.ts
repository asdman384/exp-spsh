import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { UIKitModule } from 'src/shared/modules';
import { DashboardPageContainer } from './containers/dashboard-page.containers';

const routes: Routes = [
  {
    path: '',
    component: DashboardPageContainer
  }
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes), UIKitModule],
  exports: [],
  declarations: [DashboardPageContainer],
  providers: []
})
export class DashboardPageModule {}
