import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable, first, map, of, tap } from 'rxjs';

import { Token } from 'src/shared/models/token';
import keys from '../../../keys.json';
import { NetworkStatusService } from './../network-status.service';
import { StorageService } from './../storage';
import { AbstractSecurityService } from './abstract-security.service';
import { REDIRECT_TOKEN, REFRESH_TOKEN } from 'src/constants';

interface GoogleToken {
  access_token: string;
  expires_in: string;
  refresh_token?: string;
  scope: string;
  token_type: 'Bearer';
  id_token: string;
}

interface RefreshToken {
  refresh_token: string;
}

@Injectable()
export class RedirectSecurityService extends AbstractSecurityService<google.accounts.oauth2.CodeClient, GoogleToken> {
  constructor(status: NetworkStatusService, storageService: StorageService, http: HttpClient) {
    super(status, storageService, http);
  }

  /**
   * https://developers.google.com/identity/protocols/oauth2/native-app
   */
  override refreshToken(): Observable<GoogleToken> {
    const token = this.storageService.get<Token>(REDIRECT_TOKEN);
    const code = this.getCode();

    if (!token && !code) {
      log('RedirectSecurityService: no token, no code, do redirect');
      return this.requestCode();
    }

    if (!token && code) {
      const body = new URLSearchParams({
        client_id: keys.CLIENT_ID,
        client_secret: keys.CLIENT_SECRET,
        redirect_uri: location.origin + location.pathname,
        grant_type: 'authorization_code',
        code: code
      });

      log('RedirectSecurityService: no token, got code, do exchange');
      return this.requestToken(body).pipe(
        tap((resp) => {
          this.storageService.put(REDIRECT_TOKEN, new Token(resp));
          this.storageService.put(REFRESH_TOKEN, { refresh_token: resp.refresh_token });
        })
      );
    }

    if (token && Date.now() < token.expiration) {
      log('RedirectSecurityService: token is valid, expiration: ' + new Date(token.expiration).toString());
      return of(token.googleToken as GoogleToken);
    }

    const refreshToken = this.storageService.get<RefreshToken>(REFRESH_TOKEN);
    this.storageService.remove(REDIRECT_TOKEN);
    if (!refreshToken) {
      log('RedirectSecurityService: token is expired, no refresh token, do redirect');
      return this.requestCode();
    }

    const body = new URLSearchParams({
      client_id: keys.CLIENT_ID,
      client_secret: keys.CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken.refresh_token
    });

    log('RedirectSecurityService: token is expired, refresh it');
    return this.requestToken(body).pipe(tap((resp) => this.storageService.put(REDIRECT_TOKEN, new Token(resp))));
  }

  /**
   * https://developers.google.com/identity/oauth2/web/guides/migration-to-gis#gis-redirect-ux
   */
  protected override buildClient(): google.accounts.oauth2.CodeClient {
    return google.accounts.oauth2.initCodeClient({
      client_id: keys.CLIENT_ID,
      scope: this.SCOPES,
      redirect_uri: location.origin + location.pathname,
      ux_mode: 'redirect',
      state: 'autologin'
    });
  }

  private requestToken(body: URLSearchParams): Observable<GoogleToken> {
    return this.http.post<GoogleToken>('https://oauth2.googleapis.com/token', body.toString(), {
      headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' })
    });
  }

  private requestCode(): Observable<any> {
    return this.status.online$.pipe(
      first((online) => online),
      map<boolean, any>(() => this.client.requestCode())
    );
  }

  private getCode(): string | null {
    const search = window.location.href.split('?')[1];
    const urlParams = new URLSearchParams(search);
    return urlParams.get('code');
  }
}
