import { AsyncPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { filter } from 'rxjs';

import { AppActions } from 'src/@state';
import { ROUTE } from 'src/constants';
import { NetworkStatusService, AbstractSecurityService } from 'src/services';
import { initialUrlParams } from 'src/shared/helpers/initial-url-params';

@Component({
  selector: 'login-page',
  template: `
    @let offline = (isOnline$ | async) === false;
    <main aria-labelledby="login-heading">
      <h1 id="login-heading" class="info">Sign in</h1>
      <div role="status" aria-atomic="true">
        @if (offline) {
          <div class="info" id="login-offline-message">
            <h2>No network connection</h2>
            <p>Connect to the internet to proceed with setup.</p>
            <mat-icon aria-hidden="true">wifi_off</mat-icon>
          </div>
        }
      </div>
      <div class="info">
        <button
          type="button"
          mat-flat-button
          color="primary"
          [disabled]="offline"
          [attr.aria-describedby]="offline ? 'login-offline-message' : null"
          (click)="login()"
        >
          Google Sign In
        </button>
      </div>
    </main>
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
    `,
  ],
  imports: [AsyncPipe, MatButtonModule, MatIconModule],
})
export class LoginPageContainer implements OnInit {
  readonly isOnline$ = this.status.online$;

  constructor(
    private readonly router: Router,
    private readonly store: Store,
    private readonly securityService: AbstractSecurityService,
    private readonly status: NetworkStatusService,
  ) {
    this.store.dispatch(AppActions.setTitle({ title: 'Login', icon: 'login' }));
    this.securityService.user$
      .pipe(
        filter(user => !!user),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.router.navigate([ROUTE.setup, ROUTE.settings], { replaceUrl: true, queryParamsHandling: 'preserve' }));
  }

  ngOnInit(): void {
    const state = initialUrlParams.get('state');

    if (state?.includes('autologin')) {
      this.login();
    }
  }

  login(): void {
    this.securityService.login();
  }
}
