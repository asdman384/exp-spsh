import { Injectable } from '@angular/core';

@Injectable()
export abstract class StorageService {
  abstract get<T>(key: new (...args: any[]) => T): T | undefined;
  abstract put<T>(key: new (...args: any[]) => T, value: T): void;
  abstract remove<T>(key: new (...args: any[]) => T): void;
}
