---
type: Data Contract
title: localStorage keys
description: Every key the app persists in the browser, what writes it, what reads it, and the pitfalls of the JSON round-trip.
tags: [interface, storage, persistence, localstorage]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: keys
    resource: ../../src/constants/local-storage-keys.ts
    title: Key constants
  - id: svc
    resource: ../../src/services/storage/local-storage.service.ts
    title: LocalStorageService
  - id: iface
    resource: ../../src/services/storage/interfaces/storage.ts
    title: StorageService abstraction
  - id: reducers
    resource: ../../src/@state/app.reducers.ts
    title: Hydration at store init
---

# Keys

| Key | Constant | Written by | Read by | Shape |
|---|---|---|---|---|
| `spreadsheetId` | `SPREADSHEET_ID` | `saveSpreadsheetId$` | store init | `string` |
| `dataSheets` | `DATA_SHEETS` | `saveSheetId$` (all sheets) | store init | `Array<Sheet>` |
| `categoriesSheetId` | `CATEGORIES_SHEET_ID` | `saveCategoriesSheetId$` | store init | `number` |
| `categories` | `CATEGORIES` | `saveCategories$` | store init | `Array<Category>` |
| `user` | `USER` | `AbstractSecurityService.login()` | `user$` seed, popup refresh | `Userinfo` |
| `token` | `TOKEN` | popup strategy | popup strategy, popup `logout()` revoke | `Token` |
| `redirect-token` | `REDIRECT_TOKEN` | redirect strategy | redirect strategy, redirect `logout()` revoke fallback | `Token` |
| `refresh-token` | `REFRESH_TOKEN` | redirect strategy | redirect strategy, redirect `logout()` revoke | `{ refresh_token }` |

The first three constants are also the `name` attributes of the setup page's read-only
inputs. The write outbox uses IndexedDB, not localStorage
([write outbox](../architecture/write-outbox.md)).

# Service

```ts
abstract class StorageService {
  get<T>(key): T | undefined;  put<T>(key, value): void;  remove(key): void;  clear(): void;
}
```

`LocalStorageService` implements it and also exposes **static** `get`/`put`, which
`app.reducers.ts` uses to build `initialState` before any injector exists, and the four
persist effects use directly.[^reducers] Only the security services go through the injected
`StorageService`.

# Round-trip caveats

- `put` skips `undefined` and `null`; `0`, `''`, and `false` are stored.
- Values go through `JSON.stringify`/`JSON.parse`: `Date`s come back as strings and class
  instances as plain objects. `Token` and `Userinfo` are only used as field bags, so this
  works.
- `get` has no `try/catch`: corrupt JSON throws during store construction and the app does
  not boot. Clearing site data recovers ([troubleshooting](../operations/troubleshooting.md)).
- `clear()` wipes the whole origin's localStorage (see logout in
  [authentication](../flows/authentication.md)).

[^reducers]: Hydration at store init
