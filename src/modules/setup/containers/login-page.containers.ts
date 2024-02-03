import { Component, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { filter } from 'rxjs';

import { AppActions } from 'src/@state';
import { ROUTE } from 'src/constants';
import { NetworkStatusService, AbstractSecurityService } from 'src/services';

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
        Google Sign In
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
export class LoginPageContainer implements OnInit {
  readonly isOnline$ = this.status.online$;

  constructor(
    private readonly router: Router,
    private readonly store: Store,
    private readonly securityService: AbstractSecurityService,
    private readonly status: NetworkStatusService
  ) {
    this.store.dispatch(AppActions.setTitle({ title: 'Login', icon: 'login' }));
    this.securityService.user$
      .pipe(
        filter((user) => !!user),
        takeUntilDestroyed()
      )
      .subscribe(() =>
        this.router.navigate([ROUTE.setup, ROUTE.settings], { replaceUrl: true, queryParamsHandling: 'preserve' })
      );
  }

  ngOnInit(): void {
    const search = window.location.href.split('?')[1];
    const urlParams = new URLSearchParams(search);
    const state = urlParams.get('state');

    if (state?.includes('autologin')) {
      this.login();
    }
  }

  login(): void {
    this.securityService.login();
  }
}
