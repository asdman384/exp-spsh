import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable } from 'rxjs';

import { USER } from 'src/constants';
import { GoogleToken, Userinfo } from 'src/shared/models';
import { NetworkStatusService } from './../network-status.service';
import { StorageService } from './../storage';

export abstract class AbstractSecurityService<C = unknown, T = GoogleToken> {
  protected readonly SCOPES =
    'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';
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
  /** The token `logout()` hands to Google's revoke endpoint, or `undefined` when none is stored. */
  protected abstract revocableToken(): string | undefined;

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
    const token = this.revocableToken();
    if (token) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- revoke() requires a callback; we don't need to react to it
      google.accounts.oauth2.revoke(token, () => {});
    }
    this.user.next(undefined);
    this.isTokenSet = false;
    this.storageService.clear();
  }
}
