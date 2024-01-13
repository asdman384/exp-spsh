import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { BehaviorSubject, ReplaySubject, first, switchMap } from 'rxjs';

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

  readonly user$ = this.user.asObservable();
  readonly token$ = this.token.asObservable();

  constructor(
    private readonly storageService: StorageService,
    private readonly status: NetworkStatusService,
    private readonly http: HttpClient
  ) {
    this.securityClient = this.createSecurityClient();
  }

  /**
   * https://developers.google.com/sheets/api/quickstart/js?hl=ru
   */
  init(): void {
    this.refreshToken();
  }

  login(): void {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    log('SecurityService: no token, no user, ask for consent ');
    this.securityClient.requestAccessToken({});

    const userRequest = (t: google.accounts.oauth2.TokenResponse) =>
      this.http.get<gapi.client.oauth2.Userinfo>('https://content.googleapis.com/oauth2/v2/userinfo', {
        headers: new HttpHeaders().set('Authorization', `Bearer ${t.access_token}`)
      });

    this.token.pipe(first(), switchMap(userRequest)).subscribe((resp) => {
      const user = new Userinfo(resp);
      this.storageService.put(USER, user);
      this.user.next(user);
      log('SecurityService: logged user ' + user.name);
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

    if (!user) {
      log('SecurityService: no User, cannot refresh token');
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
}
