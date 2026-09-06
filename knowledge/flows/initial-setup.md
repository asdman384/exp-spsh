---
type: Flow
title: Initial setup
description: Binding a spreadsheet to the app - URL parsing, tab discovery, tab creation, validation formatting, and the state that unlocks the dashboard.
tags: [flow, setup, onboarding, sheets]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: setup
    resource: ../../src/modules/setup/setup-page/setup-page.container.ts
    title: SettingsPageContainer
  - id: setuphtml
    resource: ../../src/modules/setup/setup-page/setup-page.container.html
    title: Setup form template
  - id: guards
    resource: ../../src/shared/guards/index.ts
    title: isSetupReady
---

# Trigger

Reached at `#/setup/settings`, either from the toolbar menu or automatically: `isLoggedIn`
and `isSetupReady` both redirect to `setup`, and `setup` redirects to `login`, which
forwards to `settings` once a user exists.[^guards]

# Steps

The form has one editable field (Spreadsheet URL) and two read-only status fields, and a
button whose label *is* the current state (`check document` then `finish`).[^setuphtml]

1. **Extract the id.** `extractSpreadsheetId` first tries
   `/spreadsheets/d/([a-zA-Z0-9-_]+)` against the pasted URL; failing that it takes the
   first `([a-zA-Z0-9-_]+)` match, so a bare id also works. It throws
   `cannot read spreadsheet id.` when neither matches.
2. **Load the spreadsheet.** `getSpreadsheet(id)` with `includeGridData: false`. On success
   the id is dispatched (`AppActions.spreadsheetId`), which the reducer stores and an effect
   persists to localStorage.
3. **Discover data sheets.** Every tab that is not hidden and whose title contains `data_`
   is mapped to `{ id: sheetId, title }` and dispatched as `upsertDataSheet`. This is how a
   shared household spreadsheet exposes *other* people's tabs in the dashboard's User
   selector. `setSpreadsheetId` is also pushed into `SpreadsheetService` here, which is what
   makes every later API call target the right document.
4. **Create the two required tabs, in parallel** (`forkJoin`):
   - `createDataSheet` -> `data_<user.name>` with 5 columns, then `setDataSheetFormats`,
     then marks `sheetDone`. It also dispatches `upsertDataSheet` and `setCurrentSheet`.
   - `createCategoriesSheet` -> `categories` with 2 columns, then
     `setCategoriesSheetFormats`, then marks `categoriesSheetDone`. It dispatches
     `categoriesSheetId`.

   `createSheet` is idempotent: if a tab with that title already exists in the loaded
   spreadsheet it is reused (`of({id, title})`) instead of created.
5. **Reset categories.** On completion the container dispatches
   `storeCategories({ categories: [] })`, clearing any cached categories from a previous
   spreadsheet, and flips the button to `finish`.
6. **Finish.** The second click navigates to `dashboard` with `replaceUrl: true` and
   `queryParams: { state: null, code: null, scope: null }`, stripping the OAuth parameters
   from the URL.

# Post-conditions

The dashboard is reachable exactly when both `spreadsheetId` and `categoriesSheetId` are
truthy in the store — that is `isSetupReady`. Both are hydrated from localStorage at boot,
so setup is a one-time action per browser, per spreadsheet.

# Failure behaviour

The pipeline has **no `catchError`**. A thrown `error getting user`, a rejected
`getSpreadsheet`, or a 403 from `addSheet` leaves `loading = true` and the spinner running
with nothing shown to the user; the reason appears only in the
[on-page log](/architecture/dependency-wiring.md). Prerequisites that commonly cause this:

- the signed-in Google account lacks **edit** rights on the spreadsheet;
- the URL points at a Docs/Slides file rather than a Sheet;
- the app is offline (there is no `isOnline` guard on this route).

[^guards]: isSetupReady
[^setuphtml]: Setup form template
