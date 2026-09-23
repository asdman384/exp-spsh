---
type: Flow
title: Initial setup
description: Binding a spreadsheet to the app - picking it with Google Picker, tab discovery, tab creation, validation formatting, and the state that unlocks the dashboard.
tags: [flow, setup, onboarding, sheets]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
sources:
  - id: setup
    resource: ../../src/modules/setup/setup-page/setup-page.container.ts
    title: SettingsPageContainer
  - id: setuphtml
    resource: ../../src/modules/setup/setup-page/setup-page.container.html
    title: Setup form template
  - id: picker
    resource: ../../src/services/picker/picker.service.ts
    title: PickerService
  - id: guards
    resource: ../../src/shared/guards/index.ts
    title: isSetupReady
---

# Trigger

`#/setup/settings`, from the toolbar menu or automatically: `isLoggedIn`/`isSetupReady`
redirect to `setup` → `login`, which forwards to `settings` once a user exists.[^guards]

The page shows three read-only fields (spreadsheet id, data sheet id, categories sheet id)
and one button whose label is the state: **Choose spreadsheet**, then **finish**.[^setuphtml]
There is no URL entry: under `drive.file` the app can only open a file the user picks.

# Steps

`SettingsPageContainer.checkSetup` calls services directly, not through effects:[^setup]

1. **Pick.** `PickerService.pickSpreadsheet()` gets a token, lazily loads the Picker, and
   opens it on `ViewId.SPREADSHEETS`.[^picker] Cancel → `undefined` → spinner stops,
   nothing else happens.
2. **Load.** `getSpreadsheet(id)` (`includeGridData: false`); dispatch `spreadsheetId`
   (stored and persisted).
3. **Discover data sheets.** `setSpreadsheetId(id)` on `SpreadsheetService`; every non-hidden
   tab whose title contains `data_` is dispatched as `upsertDataSheet` — this exposes other
   people's tabs in the User selector.
4. **Ensure the two tabs, in parallel** (`forkJoin`). `createSheet` reuses a tab with the
   same title if present, else calls `addSheet`:
   - `data_<user.name>` (5 columns) → `upsertDataSheet`, `setCurrentSheet` →
     `setDataSheetFormats` → data-sheet icon turns green;
   - `categories` (2 columns) → `categoriesSheetId` → `setCategoriesSheetFormats` →
     categories icon turns green.
5. **Reset categories.** Dispatch `storeCategories([])` and switch the button to **finish**.
6. **Finish.** Navigate to `dashboard` (`replaceUrl`), stripping `state`, `code`, `scope`.

# Post-conditions

The dashboard opens when `spreadsheetId` and `categoriesSheetId` are both truthy
(`isSetupReady`). Both persist in localStorage until logout.

# Failure behaviour

A trailing `catchError` logs the error and stops the spinner; there is no toast and no
message, and the button stays on **Choose spreadsheet** so the user can retry. The cause is
only in the [log overlay](../architecture/dependency-wiring.md#the-global-log). Common causes:

- the account lacks **edit** rights (the first `batchUpdate` fails);
- offline (the route has no `isOnline` guard);
- a Picker load failure, or an empty `APP_ID` in `keys.json`
  ([known issues](../constraints/known-issues.md) #29).

Steps 2–4 may have partly run before the failure (e.g. `spreadsheetId` stored, one tab
created); a retry reuses existing tabs.

[^guards]: isSetupReady
[^picker]: PickerService
[^setuphtml]: Setup form template
[^setup]: SettingsPageContainer
