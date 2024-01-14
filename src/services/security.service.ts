import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { BehaviorSubject, Observable, ReplaySubject, first, skip, switchMap } from 'rxjs';

import { Token, Userinfo } from 'src/shared/models';

import keys from '../../keys.json';
import { NetworkStatusService } from './network-status.service';
import { StorageService } from './storage';

const USER = 'user';
const TOKEN = 'token';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile';

@Injectable({ providedIn: 'root' })
export class SecurityService {
  private isTokenSet: boolean = false;
  private readonly securityClient: google.accounts.oauth2.TokenClient;

  private readonly user = new BehaviorSubject<Userinfo | undefined>(this.storageService.get<Userinfo>(USER));
  private token = new ReplaySubject<google.accounts.oauth2.TokenResponse>(1);

  readonly user$ = this.user.asObservable();

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
    // this.refreshToken();
  }

  login(): void {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    log('Security: no token, no user, ask for consent ');
    this.securityClient.requestAccessToken({});

    const userRequest = (t: google.accounts.oauth2.TokenResponse) =>
      this.http.get<gapi.client.oauth2.Userinfo>(
        'https://content.googleapis.com/oauth2/v2/userinfo'
        //  , {        headers: new HttpHeaders().set('Authorization', `Bearer ${t.access_token}`)      }
      );

    this.token.pipe(first(), switchMap(userRequest)).subscribe((resp) => {
      const user = new Userinfo(resp);
      this.storageService.put(USER, user);
      this.user.next(user);
      log('Security: logged user ' + user.name);
    });
  }

  logout(): void {
    const token = this.storageService.get<Token>(TOKEN);
    if (token) {
      google.accounts.oauth2.revoke(token.googleToken.access_token, () => {});
    }
    this.user.next(undefined);
    this.token.complete();
    this.token = new ReplaySubject<google.accounts.oauth2.TokenResponse>();
    this.isTokenSet = false;

    this.storageService.clear();
  }

  refreshToken(): Observable<google.accounts.oauth2.TokenResponse> {
    const user = this.storageService.get<Userinfo>(USER);
    const token = this.storageService.get<Token>(TOKEN);

    if (token && Date.now() < token.expiration) {
      this.token.next(token.googleToken);
      this.isTokenSet = true;
      log('Security: token is valid, expiration: ' + new Date(token.expiration).toString());
      return this.token.asObservable();
    }

    if (!user) {
      log('Security: no User, cannot refresh token');
      return this.token.asObservable();
    }

    log('Security: request new token without consent');
    this.status.online$.pipe(first((online) => online)).subscribe(() => {
      // Skip display of account chooser and consent dialog for an existing expired session.
      this.securityClient.requestAccessToken({ prompt: 'none', login_hint: user.id });
    });

    if (this.isTokenSet) {
      return this.token.asObservable().pipe(skip(1));
    }

    return this.token.asObservable();
  }

  private createSecurityClient(): google.accounts.oauth2.TokenClient {
    const callback = (token: google.accounts.oauth2.TokenResponse) => {
      if (token.error) {
        log('Security: token response error: ', token.error);
        this.storageService.remove(TOKEN);
        this.token.error(token.error);
        return;
      }

      const tokenObj = new Token(token);
      this.token.next(token);
      this.isTokenSet = true;
      this.storageService.put(TOKEN, tokenObj);
      log('Security: token response success, expiration: ' + new Date(tokenObj.expiration).toString());
    };

    return google.accounts.oauth2.initTokenClient({
      client_id: keys.CLIENT_ID,
      scope: SCOPES,
      prompt: '',
      callback,
      error_callback: (error: google.accounts.oauth2.ClientConfigError) => log('Security: token request error: ', error)
    });
  }
}
