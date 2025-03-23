import { Component, Inject } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';

@Component({
    selector: 'exp-dialog',
    imports: [MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose],
    templateUrl: './dialog.component.html',
    styleUrl: './dialog.component.scss'
})
export class ExpDialogComponent {
  title = this.data?.title;
  content = this.data?.content;

  constructor(public dialogRef: MatDialogRef<ExpDialogComponent>, @Inject(MAT_DIALOG_DATA) private readonly data: any) {}

  onOK() {
    this.dialogRef.close(true);
  }
  onCancel() {
    this.dialogRef.close(false);
  }
}
