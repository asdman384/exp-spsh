---
type: Data Contract
title: localStorage keys
description: Every key the app persists in the browser, what writes it, what reads it, and the pitfalls of the JSON round-trip.
tags: [interface, storage, persistence, localstorage]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
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
| `spreadsheetId` | `SPREADSHEET_ID` | `saveSpreadsheetId$` | store init, setup form field name | `string` |
| `dataSheets` | `DATA_SHEETS` | `saveSheetId$` (all sheets) | store init, setup form field name | `Array<Sheet>` |
| `categoriesSheetId` | `CATEGORIES_SHEET_ID` | `saveCategoriesSheetId$` | store init, setup form field name | `number` |
| `categories` | `CATEGORIES` | `saveCategories$` | store init | `Array<Category>` |
| `user` | `USER` | `AbstractSecurityService.login()` | `user$` seed | `Userinfo` |
| `token` | `TOKEN` | popup strategy | popup strategy, `logout()` revoke | `Token` |
| `redirect-token` | `REDIRECT_TOKEN` | redirect strategy | redirect strategy | `Token` |
| `refresh-token` | `REFRESH_TOKEN` | redirect strategy | redirect strategy | `{ refresh_token }` |

Note that the first three constants double as **form control names** on the setup page, so
the localStorage key strings also appear in the DOM.

# Service

```ts
abstract class StorageService {
  get<T>(key): T | undefined;  put<T>(key, value): void;  remove(key): void;  clear(): void;
}
```

`LocalStorageService` implements it and additionally exposes **static** `get`/`put`, which
is how `app.reducers.ts` hydrates `initialState` before any injector exists.[^reducers] The
abstraction is bound in `app.config.ts`, so a session-storage or in-memory implementation
could be swapped in for everything except that static hydration path.

# Round-trip caveats

- `put` **silently skips falsy values** (`if (value) ...`), so `0`, `''`, and `false` are
  never written. In practice this affects nothing today, but a `categoriesSheetId` of `0` —
  a legitimate Google gid for the first tab — would not persist. The guarding effect
  compensates by testing `!== undefined` before calling `put`, yet the service-level skip
  still applies.
- Everything goes through `JSON.parse`/`JSON.stringify`, so **`Date` objects come back as
  strings** and class instances come back as plain objects. `Token` is read as
  `Token`-shaped data and only its `expiration` number is used, which is why this works.
  `Userinfo` is likewise used as a bag of fields.
- `get` does not `try/catch`: corrupted JSON in any key throws during store construction and
  the app fails to boot. Clearing site data is the recovery
  ([troubleshooting](../operations/troubleshooting.md)).
- `clear()` wipes **the whole origin**, not just these keys — see the logout note in
  [authentication](../flows/authentication.md).

[^reducers]: Hydration at store init
