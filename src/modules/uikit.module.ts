import { NgModule } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';

@NgModule({
  imports: [MatToolbarModule, MatProgressBarModule, MatButtonModule, MatMenuModule, MatIconModule],
  exports: [MatToolbarModule, MatProgressBarModule, MatButtonModule, MatMenuModule, MatIconModule]
})
export class UIKitModule {}
