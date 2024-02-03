import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable } from 'rxjs';

import { TOKEN, USER } from 'src/constants';
import { GoogleToken, Token, Userinfo } from 'src/shared/models';
import { NetworkStatusService } from './../network-status.service';
import { StorageService } from './../storage';

export abstract class AbstractSecurityService<C = any, T = GoogleToken> {
  protected readonly SCOPES =
    'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile';
  protected isTokenSet: boolean = false;
  protected readonly user = new BehaviorSubject<Userinfo | undefined>(this.storageService.get<Userinfo>(USER));
  protected readonly client: C;

  readonly user$ = this.user.asObservable();

  constructor(
    protected readonly status: NetworkStatusService,
    protected readonly storageService: StorageService,
    protected readonly http: HttpClient
  ) {
    this.client = this.buildClient();
  }

  protected abstract buildClient(): C;
  abstract refreshToken(): Observable<T>;

  login(): void {
    this.http
      .get<gapi.client.oauth2.Userinfo>('https://content.googleapis.com/oauth2/v2/userinfo')
      .subscribe((resp) => {
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
    this.isTokenSet = false;
    this.storageService.clear();
  }
}
