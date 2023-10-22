import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import keys from '../../keys.json';
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
  constructor(obj: gapi.client.oauth2.Userinfo) {
    Object.assign(this, obj);
  }
}

@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly loading: BehaviorSubject<boolean> = new BehaviorSubject(false);
  private readonly user: BehaviorSubject<Userinfo | undefined> = new BehaviorSubject<Userinfo | undefined>(undefined);
  private client!: google.accounts.oauth2.TokenClient;
  private tokenResolver!: (value: google.accounts.oauth2.TokenResponse) => void;
  private tokenError!: (reason?: any) => void;
  private readonly token = new Promise<google.accounts.oauth2.TokenResponse>((resolve, reject) => {
    this.tokenResolver = resolve;
    this.tokenError = reject;
  });

  readonly user$ = this.user.asObservable();
  readonly loading$ = this.loading.asObservable();

  constructor(private readonly storageService: StorageService) {}

  init(): void {
    let user = this.storageService.get(Userinfo);
    user && this.user.next(user);

    this.loading.next(true);

    gsiLoaded.then(() => {
      this.initAuthClient();
      this.auth(user);
    });

    Promise.all([this.token, this.initGapiClient()])
      .then(([token]) => {
        gapi.client.setToken(token);
        if (user) return user;
        return gapi.client.oauth2.userinfo.get().then((resp) => resp.result);
      })
      .then((user) => {
        this.user.next(user);
        this.storageService.put(Userinfo, user);
        this.loading.next(false);
      });
  }

  private initAuthClient(): void {
    this.client = google.accounts.oauth2.initTokenClient({
      client_id: keys.CLIENT_ID,
      scope: SCOPES,
      callback: (token: google.accounts.oauth2.TokenResponse) => {
        if (token.error) {
          alert('SecurityService: ' + token.error);
          sessionStorage.removeItem('token');
          this.tokenError(token);
          return;
        }

        this.tokenResolver(token);
        this.storageService.put(Token, new Token(token));
      }
    });
  }

  private async initGapiClient(): Promise<void> {
    await apiLoaded;

    let configured: (value: void | PromiseLike<void>) => void;
    let error: (reason?: any) => void;
    gapi.load('client', () => {
      gapi.client.load(environment.OAUTH2_DISCOVERY_DOC);
      gapi.client
        .init({ apiKey: keys.API_KEY, discoveryDocs: [environment.SHEETS_DISCOVERY_DOC] })
        .then(configured)
        .catch(error);
    });

    return new Promise((resolve, reject) => {
      configured = resolve;
      error = reject;
    });
  }

  private auth(user: gapi.client.oauth2.Userinfo | undefined): void {
    const token = this.storageService.get(Token);

    if (!token || !user) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      this.client.requestAccessToken({});
      return;
    }

    // Skip display of account chooser and consent dialog for an existing expired session.
    if (Date.now() > token.expiration) {
      this.client.requestAccessToken({ prompt: 'none', login_hint: user.id });
      return;
    }

    this.tokenResolver(token.googleToken);
  }
}
