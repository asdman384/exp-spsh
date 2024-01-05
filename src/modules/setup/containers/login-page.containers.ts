import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';

import { first } from 'rxjs';

import { ROUTE } from 'src/constants';
import { NetworkStatusService, SecurityService } from 'src/services';

@Component({
  selector: 'login-page',
  template: `
    <div class="info" *ngIf="(isOnline$ | async) === false">
      <h2>No network connection</h2>
      <p>Connect to the internet to proceed with setup.</p>
      <mat-icon>wifi_off</mat-icon>
    </div>
    <div class="info">
      <button mat-flat-button color="primary" [disabled]="(isOnline$ | async) === false" (click)="login()">
        Login
      </button>
    </div>
  `,
  styles: [
    `
      .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 20px;
      }

      .mat-icon {
        height: 36px;
        width: 36px;
        font-size: 36px;
      }
    `
  ]
})
export class LoginPageContainer {
  readonly isOnline$ = this.status.online$;

  constructor(
    private readonly router: Router,
    private readonly securityService: SecurityService,
    private readonly status: NetworkStatusService,
    private readonly ngZone: NgZone
  ) {}

  login(): void {
    this.securityService.login();
    this.securityService.user$
      .pipe(first((user) => !!user))
      .subscribe(() => this.router.navigate([ROUTE.setup, ROUTE.settings], { replaceUrl: true }));
  }
}
