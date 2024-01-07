import { Injectable } from '@angular/core';
import { StorageService } from './interfaces/storage';

@Injectable()
export class LocalStorageService implements StorageService {
  static get<T>(key: string): T | undefined {
    let item = localStorage.getItem(key);
    if (item) return JSON.parse(item) as T;

    return undefined;
  }

  static put<T>(key: string, value: T): void {
    if (value) localStorage.setItem(key, JSON.stringify(value));
  }

  get<T>(key: string): T | undefined {
    return LocalStorageService.get<T>(key);
  }

  put<T>(key: string, value: T): void {
    LocalStorageService.put<T>(key, value);
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }
}
