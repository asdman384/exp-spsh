import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, first, skip } from 'rxjs';
import { TOKEN, USER } from 'src/constants';
import { Token, Userinfo } from 'src/shared/models';
import keys from '../../../keys.json';
import { NetworkStatusService } from './../network-status.service';
import { StorageService } from './../storage';
import { AbstractSecurityService } from './abstract-security.service';

@Injectable()
export class PopupSecurityService extends AbstractSecurityService<
  google.accounts.oauth2.TokenClient,
  google.accounts.oauth2.TokenResponse
> {
  private token = new ReplaySubject<google.accounts.oauth2.TokenResponse>(1);
  constructor(status: NetworkStatusService, storageService: StorageService, http: HttpClient) {
    super(status, storageService, http);
  }

  override refreshToken(): Observable<google.accounts.oauth2.TokenResponse> {
    const user = this.storageService.get<Userinfo>(USER);
    const token = this.storageService.get<Token>(TOKEN);

    if (!user) {
      log('PopupSecurityService: no User, request new token and consent');
      this.client.requestAccessToken({});
      return this.token.asObservable();
    }

    if (token && Date.now() < token.expiration) {
      this.token.next(token.googleToken as google.accounts.oauth2.TokenResponse);
      this.isTokenSet = true;
      log('PopupSecurityService: token is valid, expiration: ' + new Date(token.expiration).toString());
      return this.token.asObservable();
    }

    log('PopupSecurityService: token is expired request new one without consent');
    this.status.online$.pipe(first((online) => online)).subscribe(() => {
      // Skip display of account chooser and consent dialog for an existing expired session.
      this.client.requestAccessToken({ prompt: 'none', login_hint: user.id });
    });

    if (this.isTokenSet) {
      return this.token.asObservable().pipe(skip(1));
    }

    return this.token.asObservable();
  }

  override logout(): void {
    this.token.complete();
    this.token = new ReplaySubject<google.accounts.oauth2.TokenResponse>();
    super.logout();
  }

  protected override buildClient(): google.accounts.oauth2.TokenClient {
    const callback = (token: google.accounts.oauth2.TokenResponse) => {
      if (token.error) {
        log('PopupSecurityService: token response error: ', token.error);
        this.storageService.remove(TOKEN);
        this.token.error(token.error);
        return;
      }

      const tokenObj = new Token(token);
      this.token.next(token);
      this.isTokenSet = true;
      this.storageService.put(TOKEN, tokenObj);
      log('PopupSecurityService: token response success, expiration: ' + new Date(tokenObj.expiration).toString());
    };

    return google.accounts.oauth2.initTokenClient({
      client_id: keys.CLIENT_ID,
      scope: this.SCOPES,
      prompt: '',
      callback,
      error_callback: (error: google.accounts.oauth2.ClientConfigError) =>
        log('PopupSecurityService: token request error: ', error)
    });
  }
}
