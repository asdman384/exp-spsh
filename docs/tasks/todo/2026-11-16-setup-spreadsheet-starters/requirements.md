# 2026-11-16: Easier First Run With Spreadsheet Creation and Starter Categories

**Status:** todo
**Priority:**
**Type:** tracking-friction
**Module(s):** client (Setup)
**Owner:** Oleg
**Created:** 2026-11-16

## Description

Let users create a Google spreadsheet from Setup and accept or edit starter categories before their first expense. Keep Google Picker available for existing spreadsheets. Hide technical IDs behind a details control.

## Functional Requirements

- FR1: Show **Create a new spreadsheet for me** next to **Choose existing** on Setup. **Choose existing** opens the existing Google Picker. Canceling Picker leaves the current selection unchanged.
- FR2: Create a spreadsheet with Sheets `spreadsheets.create`, title it **Expenses**, and use the returned spreadsheet ID without opening Picker. Ensure the existing `data_<user.name>` and `categories` tabs and their formats and validations before enabling Finish. Reuse matching tabs and preserve existing expense rows.
- FR3: After tab setup, read categories from the selected spreadsheet. Offer starters for both app-created spreadsheets and selected existing spreadsheets with no categories. A failed read is an error, not evidence that the sheet is empty. If categories already exist, load them into app state and do not offer or write starters.
- FR4: Offer these categories in this order: Groceries, Eating out, Transport, Home, Health, Clothes, Entertainment, Subscriptions, Gifts, Other. Let users accept the set or edit names, add entries, and remove entries before saving. Keep edits local until explicit acceptance. Trim names and reject blank names and exact duplicate names with visible validation messages.
- FR5: Save accepted categories through the existing category service methods and `categories!A:B` format: name in A and non-negative numeric position in B. Save all accepted entries in displayed order, assigning positions from 0. Wait for every write to succeed before reporting success or enabling Finish; update cached categories from the saved result. Do not clear saved categories at the end of Setup.
- FR6: Offer **Skip** so users can finish with no categories and add them later from the existing Categories page. Skip writes no starter rows. If all entries are removed, direct users to Skip instead of sending an empty category update.
- FR7: Hide the spreadsheet ID, data sheet ID, and categories sheet ID by default. A **details** control reveals and hides all three existing read-only fields. Keep progress and errors visible when details is closed.
- FR8: Disable conflicting setup actions while a request is active. Show a visible error on creation, tab setup, category read, or category save failure, stop the progress indicator, and allow retry. Retain the category draft and any returned spreadsheet ID during the current Setup visit. Retry later setup steps against that spreadsheet instead of creating another file. Before retrying category writes, read the saved rows and avoid duplicate or overwritten categories. Never automatically retry a creation request whose result is unknown; explain that a file might exist and offer Choose existing to recover it.
- FR9: Finish navigates to the existing dashboard only after tab setup and either successful category saving, loading existing categories, or Skip. Accepted categories are available for the first expense without a page reload.

## Non-Functional Requirements

- Use the existing browser-to-Google API design, Angular HttpClient authentication, and `drive.file` scope. Do not add broader scopes, a backend, or an SDK for spreadsheet creation.
- Reuse installed Angular Material controls or native HTML controls. Keep both spreadsheet choices in the same action group; allow wrapping on narrow screens. All new controls support keyboard use and have visible labels.
- Preserve the existing spreadsheet schema and category management behavior. Editing starter names does not rename categories already saved in a spreadsheet.
- Setup requires a network connection; do not send these operations through the expense outbox.

## Acceptance Criteria

- [ ] AC1 (FR1): Setup shows both named spreadsheet choices together. Choose existing uses Google Picker; cancellation makes no changes to the selected spreadsheet or its data.
- [ ] AC2 (FR2): With existing `drive.file` authorization, creation returns a spreadsheet titled Expenses and Setup uses its ID without Picker. Both required tabs have the existing formats and validations before Finish is available.
- [ ] AC3 (FR3): New spreadsheets and existing spreadsheets with an empty or newly created categories tab offer starters. Existing non-empty category sheets load their categories without starter writes. A failed category read shows an error and does not offer starters.
- [ ] AC4 (FR4, FR5): Accepting the unchanged set saves all ten listed names once, in the listed order, with positions 0 through 9. The first expense form shows these categories without a reload.
- [ ] AC5 (FR4, FR5): Renaming an entry, adding an entry, and removing an entry before acceptance saves only the final edited set. Blank names and exact duplicates after trimming prevent saving and show validation messages.
- [ ] AC6 (FR6): Skip enables completion with an empty categories sheet and sends no category writes. Removing all entries offers Skip and does not send an invalid empty-range update.
- [ ] AC7 (FR7): All three IDs are hidden on entry. The details control reveals and hides them as read-only fields without hiding progress or errors.
- [ ] AC8 (FR8): Repeated clicks during a request do not create concurrent files or category writes. Each failure stops progress, shows an error, and permits retry without falsely reporting completion.
- [ ] AC9 (FR8): If creation succeeds but tab setup fails, retry uses the returned file ID. If category saving partly succeeds or its response is lost, retry reads persisted rows and completes without duplicate names or overwriting existing categories. An unknown creation result does not trigger an automatic second creation request.
- [ ] AC10 (FR2, FR3, FR9): Reopening Setup for a populated spreadsheet preserves its expense rows and category rows. Finish opens the dashboard only after the required setup work and category choice are complete.
- [ ] AC11: At narrow screen widths both choices remain usable without horizontal scrolling. All new actions, category editing, and the details control work with the keyboard.

## Common sense considerations

- Use Expenses as the initial spreadsheet title; users can rename the file in Google Sheets.
- Starter editing supports names, additions, and removals; a new drag-and-drop reorder feature is outside scope.
- Keep the existing case-sensitive category name identity after trimming starter input.
- Keep any default blank tab created by Google; removal is not required for setup.
- Scope retry state retention to the current Setup visit; after reload, users can select a created file through Choose existing.
- Reuse the existing category service writes, but do not dispatch ten add actions at once: the current `addCategory$` effect uses `exhaustMap` and ignores actions while a write is active.

## Open Questions

None.

## Notes

- Sources: `src/modules/setup/setup-page/setup-page.container.ts`, its HTML template, `src/services/spreadsheet/spreadsheet.service.ts`, `src/@state/app.effects.ts`, and `src/modules/dashboard/categories/categories-page.container.ts`.
- The Sheets API accepts `drive.file` for spreadsheet creation: [spreadsheets.create](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/create).
