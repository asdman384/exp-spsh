import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UIKitModule } from '../../shared/modules/uikit.module';
import { RouterModule, Routes } from '@angular/router';
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
