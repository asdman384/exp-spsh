import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, combineLatest, filter, first, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import keys from '../../keys.json';
import { NetworkStatusService } from './network-status.service';
import { StorageService } from './storage';

declare var apiLoaded: Promise<void>; // see index.html
declare var gsiLoaded: Promise<void>; // see index.html

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile';

class Token {
  expiration: number;
  constructor(public googleToken: google.accounts.oauth2.TokenResponse) {
    this.expiration = Date.now() + Number(googleToken.expires_in) * 1000 - 60_000;
  }
}

class Userinfo implements gapi.client.oauth2.Userinfo {
  /** The user's email address. */
  email?: string;
  /** The user's last name. */
  family_name?: string;
  /** The user's gender. */
  gender?: string;
  /** The user's first name. */
  given_name?: string;
  /** The hosted domain e.g. example.com if the user is Google apps user. */
  hd?: string;
  /** The obfuscated ID of the user. */
  id?: string;
  /** URL of the profile page. */
  link?: string;
  /** The user's preferred locale. */
  locale?: string;
  /** The user's full name. */
  name?: string;
  /** URL of the user's picture image. */
  picture?: string;
  /** Boolean flag which is true if the email address is verified. Always verified because we only return the user's primary email address. */
  verified_email?: boolean;

  constructor(obj: gapi.client.oauth2.Userinfo) {
    Object.assign(this, obj);
  }
}

@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly securityClient$ = new BehaviorSubject<google.accounts.oauth2.TokenClient | undefined>(undefined);
  private readonly loading: BehaviorSubject<boolean> = new BehaviorSubject(false);
  private readonly user = new BehaviorSubject<Userinfo | undefined>(this.storageService.get(Userinfo));
  private readonly token$ = new BehaviorSubject<google.accounts.oauth2.TokenResponse | undefined>(
    this.storageService.get(Token)?.googleToken
  );

  readonly user$ = this.user.asObservable();
  readonly loading$ = this.loading.asObservable();

  constructor(private readonly storageService: StorageService, private readonly status: NetworkStatusService) {}

  /**
   * https://developers.google.com/sheets/api/quickstart/js?hl=ru
   */
  init(): void {
    log('SecurityService::init begin');

    this.initSecurityClient();
    const gapiClientReady = this.initGapiClient();
    this.refreshToken();

    combineLatest([this.token$, gapiClientReady])
      .pipe(filter(([t]) => !!t))
      .subscribe(([t]) => gapi.client.setToken(t!));
  }

  login(): void {
    this.loading.next(true);

    this.securityClient$.pipe(first((c) => !!c)).subscribe((client) => {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      log('SecurityService: no token, no user, ask for consent ');
      client!.requestAccessToken({});
    });

    this.token$.pipe(first((t) => !!t)).subscribe(() => {
      gapi.client.oauth2.userinfo
        .get()
        .then((resp) => resp.result)
        .then((user) => {
          this.user.next(user);
          this.storageService.put(Userinfo, user);
          this.loading.next(false);
          log('SecurityService: logged user' + (user.name ?? user.given_name));
        });
    });
  }

  logout(): void {
    const token = this.storageService.get(Token);
    if (token) {
      google.accounts.oauth2.revoke(token.googleToken.access_token, () => {});
    }
    gapi.client.setToken(null);
    this.user.next(undefined);
    this.token$.next(undefined);
    this.storageService.remove(Userinfo);
    this.storageService.remove(Token);
  }

  refreshToken(): void {
    const user = this.storageService.get(Userinfo);
    const token = this.storageService.get(Token);

    if (!user) {
      log('SecurityService: no User, cannot refresh token');
      return;
    }

    if (token && Date.now() < token.expiration) {
      log('SecurityService: token still valid, no refresh, expiration:', new Date(token.expiration).toString());
      return;
    }

    log('SecurityService: refresh token without consent');
    combineLatest([this.securityClient$, this.status.online$])
      .pipe(first(([client, online]) => !!client && online))
      .subscribe(([client]) => {
        // Skip display of account chooser and consent dialog for an existing expired session.
        client!.requestAccessToken({ prompt: 'none', login_hint: user!.id });
      });
  }

  private async initSecurityClient(): Promise<void> {
    await gsiLoaded;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: keys.CLIENT_ID,
      scope: SCOPES,
      callback: (token: google.accounts.oauth2.TokenResponse) => {
        if (token.error) {
          log('SecurityService: token request error', token.error);
          this.storageService.remove(Token);
          this.token$.error(token.error);
          return;
        }

        log(
          'SecurityService: token request success, expiration:',
          new Date(Date.now() + Number(token.expires_in) * 1000 - 60_000).toString()
        );
        this.token$.next(token);
        this.storageService.put(Token, new Token(token));
      }
    });

    this.securityClient$.next(client);
    log('SecurityService: security client ready');
  }

  private initGapiClient(): Subject<void> {
    const gapiClientReady$ = new Subject<void>();

    apiLoaded.then(() => {
      gapi.load('client', () => {
        this.status.online$.pipe(first((isOnline) => isOnline)).subscribe(() => {
          log('SecurityService: gapi client loading');
          Promise.all([
            gapi.client.load(environment.OAUTH2_DISCOVERY_DOC),
            gapi.client.init({ apiKey: keys.API_KEY, discoveryDocs: [environment.SHEETS_DISCOVERY_DOC] })
          ])
            .then(() => {
              log('SecurityService: gapi client ready');
              gapiClientReady$.next();
              gapiClientReady$.complete();
            })
            .catch((error) => gapiClientReady$.error(error));
        });
      });
    });

    return gapiClientReady$;
  }
}
