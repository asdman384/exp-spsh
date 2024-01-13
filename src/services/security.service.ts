import { Injectable, NgZone } from '@angular/core';

import { BehaviorSubject, ReplaySubject, first, forkJoin, switchMap } from 'rxjs';

import { environment } from 'src/environments/environment';
import { Token, Userinfo } from 'src/shared/models';

import keys from '../../keys.json';
import { NetworkStatusService } from './network-status.service';
import { StorageService } from './storage';

const USER = 'user';
const TOKEN = 'token';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile';

@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly securityClient: google.accounts.oauth2.TokenClient;

  private readonly user = new BehaviorSubject<Userinfo | undefined>(this.storageService.get<Userinfo>(USER));
  private readonly token = new ReplaySubject<google.accounts.oauth2.TokenResponse>();
  private readonly gapiReady = new BehaviorSubject<boolean>(false);

  readonly user$ = this.user.asObservable();
  readonly token$ = this.token.asObservable();
  readonly gapiReady$ = this.gapiReady.asObservable();

  constructor(
    private readonly storageService: StorageService,
    private readonly status: NetworkStatusService,
    private readonly zone: NgZone
  ) {
    this.securityClient = this.createSecurityClient();
  }

  /**
   * https://developers.google.com/sheets/api/quickstart/js?hl=ru
   */
  init(): void {
    gapi.load('client', () => {
      this.initGapiClient();
      this.token$.subscribe((t) => gapi.client.setToken(t));
    });
    this.refreshToken();
  }

  login(): void {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    log('SecurityService: no token, no user, ask for consent ');
    this.securityClient.requestAccessToken({});

    this.token.pipe(first((t) => !!t)).subscribe(() => {
      gapi.client.oauth2.userinfo
        .get()
        .then((resp) => new Userinfo(resp.result))
        .then((user) => {
          this.storageService.put(USER, user);
          this.zone.run(() => this.user.next(user));
          log('SecurityService: logged user ' + (user.name ?? user.given_name));
        });
    });
  }

  logout(): void {
    const token = this.storageService.get<Token>(TOKEN);
    if (token) {
      google.accounts.oauth2.revoke(token.googleToken.access_token, () => {});
    }
    gapi.client.setToken(null);
    this.user.complete();
    this.token.complete();
    this.storageService.clear();
  }

  private refreshToken(): void {
    const user = this.storageService.get<Userinfo>(USER);
    const token = this.storageService.get<Token>(TOKEN);

    if (token && Date.now() < token.expiration) {
      this.token.next(token.googleToken);
      log('SecurityService: token still valid, no refresh, expiration:', new Date(token.expiration).toString());
      return;
    }

    log('SecurityService: refresh token without consent');
    this.status.online$.pipe(first((online) => online)).subscribe(() => {
      // Skip display of account chooser and consent dialog for an existing expired session.
      this.securityClient.requestAccessToken({ prompt: 'none', login_hint: user?.id });
    });
  }

  private createSecurityClient(): google.accounts.oauth2.TokenClient {
    const callback = (token: google.accounts.oauth2.TokenResponse) => {
      if (token.error) {
        log('SecurityService: token request error: ', token.error);
        this.storageService.remove(TOKEN);
        this.token.error(token.error);
        return;
      }

      log(
        'SecurityService: token request success, expiration:',
        new Date(Date.now() + Number(token.expires_in) * 1000 - 60_000).toString()
      );
      this.token.next(token);
      this.storageService.put(TOKEN, new Token(token));
    };

    const error_callback = (error: google.accounts.oauth2.ClientConfigError) => {
      log('SecurityService: error', error);
    };

    return google.accounts.oauth2.initTokenClient({
      client_id: keys.CLIENT_ID,
      scope: SCOPES,
      prompt: '',
      callback,
      error_callback
    });
  }

  private initGapiClient(): void {
    const initGapi$ = forkJoin([
      // https://content.googleapis.com/discovery/v1/apis/oauth2/v2/rest?pp
      gapi.client.load(environment.OAUTH2_DISCOVERY_DOC),
      // https://content-sheets.googleapis.com/$discovery/rest?version=v4
      gapi.client.init({ apiKey: keys.API_KEY, discoveryDocs: [environment.SHEETS_DISCOVERY_DOC] })
    ]);

    this.status.online$
      .pipe(first((isOnline) => isOnline))
      .pipe(switchMap(() => initGapi$))
      .subscribe({
        next: () => {
          log('SecurityService: gapi client ready');
          this.zone.run(() => this.gapiReady.next(true));
        },
        error: (e) => {
          log('SecurityService: gapi client error loading', e);
        }
      });
  }
}
