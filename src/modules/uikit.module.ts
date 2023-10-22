import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';

@NgModule({
  imports: [MatToolbarModule, MatProgressBarModule, MatButtonModule],
  exports: [MatToolbarModule, MatProgressBarModule, MatButtonModule]
})
export class UIKitModule {}
