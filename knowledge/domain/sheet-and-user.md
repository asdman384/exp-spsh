---
type: Domain Entity
title: Sheet, User, and Token
description: The supporting entities - a spreadsheet tab, the Google profile that names it, and the OAuth token wrapper that tracks expiry.
tags: [domain, sheet, user, token, model]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: sheet
    resource: ../../src/shared/models/sheet.ts
    title: Sheet interface
  - id: token
    resource: ../../src/shared/models/token.ts
    title: Token / GoogleToken
  - id: userinfo
    resource: ../../src/shared/models/user-info.ts
    title: Userinfo class
  - id: consts
    resource: ../../src/constants/spreadsheets.ts
    title: Sheet title constants
---

# Sheet

```ts
interface Sheet {
  id: number;     // Google Sheets sheetId (gid), stable per tab
  title: string;  // tab name, e.g. "data_Oleg" or "categories"
}
```

A `Sheet` is one **tab** inside the single spreadsheet, not the spreadsheet itself. Two
title conventions matter, both from `src/constants/spreadsheets.ts`:[^consts]

| Constant | Value | Meaning |
|---|---|---|
| `CATEGORIES_SHEET_TITLE` | `categories` | the single category tab |
| `DATA_SHEET_TITLE_PREFIX` | `data_` | prefix for per-person expense tabs |

Setup discovers data sheets by filtering the spreadsheet's tabs to those that are **not
hidden** and whose title *contains* `data_`, and creates `data_<user.name>` if missing.
The UI displays `sheet.title.split('_')[1]` as the person's name, so a display name
containing `_` renders truncated.

`Sheet.id` (the gid) is what the API needs for row-level `batchUpdate` operations and for
the `gid` parameter of the [gviz query](/interfaces/gviz-query.md); `Sheet.title` is what
range-based `values.*` calls need — which is why both are carried together, and why the
NgRx entity adapter keys sheets by title
([state management](/architecture/state-management.md)).

# Userinfo

`Userinfo` is a class implementing `gapi.client.oauth2.Userinfo` with `id` and `name`
defaulted to `''` and the rest `Object.assign`-ed from the API response.[^userinfo] The app
uses three fields:

- `name` — chooses the data sheet (`data_<name>`) and is logged on sign-in;
- `picture` — the toolbar avatar;
- `id` — passed as `login_hint` when the popup strategy refreshes silently.

It is persisted whole to `localStorage` under the `user` key, and its presence *is* the
app's definition of "logged in" ([authentication](/flows/authentication.md)).

# Token

```ts
class Token {
  expiration: number;                       // epoch ms
  constructor(public googleToken: GoogleToken) {
    this.expiration = Date.now() + Number(googleToken.expires_in) * 1000 - 60000;
  }
}
```

The wrapper converts Google's relative `expires_in` (seconds) into an absolute instant and
subtracts a **60-second safety margin**, so the app treats a token as expired a minute
before Google does.[^token] Validity is always tested as `Date.now() < token.expiration`.

Tokens are persisted under different keys per strategy: `token` for the popup strategy,
`redirect-token` plus `refresh-token` for the redirect strategy. See
[local storage](/interfaces/local-storage.md).

[^consts]: Sheet title constants
[^userinfo]: Userinfo class
[^token]: Token / GoogleToken
