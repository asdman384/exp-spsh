import { Injectable } from '@angular/core';
import { StorageService } from './interfaces/storage';

@Injectable()
export class LocalStorageService implements StorageService {
  get<T>(key: new () => T): T | undefined {
    let item = localStorage.getItem(key.name);
    if (item) return JSON.parse(item) as T;

    return undefined;
  }

  put<T>(key: new () => T, value: T): void {
    if (value) localStorage.setItem(key.name, JSON.stringify(value));
  }
}
