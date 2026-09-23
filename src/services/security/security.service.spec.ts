import { HttpClient } from '@angular/common/http';

import { REDIRECT_TOKEN, REFRESH_TOKEN, TOKEN } from 'src/constants';
import { Token } from 'src/shared/models';
import { NetworkStatusService } from '../network-status.service';
import { StorageService } from '../storage';
import { PopupSecurityService } from './popup-security.service';
import { RedirectSecurityService } from './redirect-security.service';

class MemoryStorage implements StorageService {
  readonly items = new Map<string, unknown>();
  get<T>(key: string): T | undefined {
    return this.items.get(key) as T | undefined;
  }
  put<T>(key: string, value: T): void {
    this.items.set(key, value);
  }
  remove(key: string): void {
    this.items.delete(key);
  }
  clear(): void {
    this.items.clear();
  }
}

const token = (access_token: string) => new Token({ access_token, expires_in: '3600' } as Token['googleToken']);

describe('AbstractSecurityService.logout', () => {
  let storage: MemoryStorage;
  let revoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = new MemoryStorage();
    revoke = vi.fn();
    vi.stubGlobal('google', {
      accounts: { oauth2: { revoke, initCodeClient: vi.fn(() => ({})), initTokenClient: vi.fn(() => ({})) } }
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const redirect = () =>
    new RedirectSecurityService({} as NetworkStatusService, storage, {} as HttpClient);
  const popup = () => new PopupSecurityService({} as NetworkStatusService, storage, {} as HttpClient);

  it('redirect strategy revokes the refresh token when one is stored', () => {
    storage.put(REDIRECT_TOKEN, token('access'));
    storage.put(REFRESH_TOKEN, { refresh_token: 'refresh' });

    redirect().logout();

    expect(revoke).toHaveBeenCalledExactlyOnceWith('refresh', expect.any(Function));
    expect(storage.items.size).toBe(0);
  });

  it('redirect strategy falls back to the access token without a refresh token', () => {
    storage.put(REDIRECT_TOKEN, token('access'));
    storage.put(REFRESH_TOKEN, {});

    redirect().logout();

    expect(revoke).toHaveBeenCalledExactlyOnceWith('access', expect.any(Function));
  });

  it('redirect strategy ignores the popup token key', () => {
    storage.put(TOKEN, token('popup'));

    redirect().logout();

    expect(revoke).not.toHaveBeenCalled();
    expect(storage.items.size).toBe(0);
  });

  it('popup strategy revokes its access token', () => {
    storage.put(TOKEN, token('popup'));

    popup().logout();

    expect(revoke).toHaveBeenCalledExactlyOnceWith('popup', expect.any(Function));
  });

  it('makes no revoke call when nothing is stored', () => {
    redirect().logout();
    popup().logout();

    expect(revoke).not.toHaveBeenCalled();
  });
});
