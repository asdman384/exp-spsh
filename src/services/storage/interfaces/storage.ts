import { Injectable } from '@angular/core';

@Injectable()
export abstract class StorageService {
  abstract get<T>(key: string): T | undefined;
  abstract put<T>(key: string, value: T): void;
  abstract remove(key: string): void;
  abstract clear(): void;
}
