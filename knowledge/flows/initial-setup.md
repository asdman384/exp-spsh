---
type: Flow
title: Initial setup
description: Creating or choosing a spreadsheet, ensuring tabs, and loading or saving starter categories before the dashboard.
tags: [flow, setup, onboarding, sheets]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
sources:
  - id: setup
    resource: ../../src/modules/setup/setup-page/setup-page.container.ts
    title: SettingsPageContainer
  - id: setuphtml
    resource: ../../src/modules/setup/setup-page/setup-page.container.html
    title: Setup form template
  - id: report
    resource: ../../src/services/spreadsheet/category-spending-report.ts
    title: Category spending report
  - id: picker
    resource: ../../src/services/picker/picker.service.ts
    title: PickerService
  - id: guards
    resource: ../../src/shared/guards/index.ts
    title: isSetupReady
---

# Trigger

`#/setup/settings` opens from the toolbar menu or the login flow. Setup calls the
spreadsheet service directly and keeps request stages and drafts in local signals.[^setup]

# File choice and tabs

The form shows **Create a new spreadsheet for me** and **Choose existing** in one wrapping
action group. Creation posts the title **Expenses** to the Sheets API with existing HTTP
authentication and `drive.file` access. It retains the returned ID before further requests.
Choose existing opens Google Picker; cancellation preserves the selected file, draft, and
completion state.[^picker] No default Google tab is removed.

For a confirmed ID, Setup sets the service ID, dispatches `spreadsheetId`, and reads fresh
metadata. A change of file clears the current user selection and the cached `dataSheets` list.
Setup fills the User selector and the cache with the selected file's visible `data_` tabs. It reuses exact matching
tab titles or creates missing tabs. It formats `categories` (two columns) first, then
`data_<user.name>` (five columns), because data validation refers to categories. Existing
expense and category rows remain unchanged. Each tab is complete only after its format
request succeeds.[^setup]

# Optional Overview report

After Setup formats both tabs, it reads the selected file's metadata again. If the file
contains the tagged spending report, Setup refreshes its list of people. The list includes
the names after the `data_` prefix from all matching tabs in spreadsheet order, including hidden tabs.
If the file has no report, Setup offers **Add Overview** beside **Finish** once the category
step is complete. The owner can add the report on any later visit.[^report]

**Retry report** reads fresh metadata for the same file. After a failed inspection it checks
the report again. After a failed Add it creates a missing report or refreshes the existing one.
If an unrelated tab uses the title `Overview`, Setup asks the owner to rename it. An invalid
report grid or ambiguous report tag prompts the owner to check the report in Sheets.
The owner can finish Setup after either conflict or a failed report request.[^setup]

# Category choice

After the report check settles, Setup reads categories. Non-empty results go to `storeCategories`
and enable Finish. An empty result opens a local draft in this order: Groceries, Eating out,
Transport, Home, Health, Clothes, Entertainment, Subscriptions, Gifts, Other.

The editor supports names, additions, and removals. Save categories trims names and rejects
blank names and exact case-sensitive duplicates. It freezes the accepted list and assigns
positions from zero in displayed order. Before every save attempt it reads persisted rows,
then calls `addCategory` sequentially for names that are absent. It preserves all existing
rows and positions. A final read publishes the saved result through `storeCategories` before
Finish becomes available. The dashboard category selector receives these names without a
reload. The existing category effect persists that state in the local cache.

Skip is available before acceptance and publishes an empty list without writes. An empty
draft directs the user to Skip. Once saving starts the draft is read-only and Skip is
unavailable, including after partial success.[^setup]

# Completion and details

Native Details starts closed and contains all three read-only ID fields. Progress and errors
remain outside it. Controls wrap on narrow screens. Busy controls are disabled and handlers
also reject concurrent actions.[^setuphtml]

Finish requires both tab flags, a completed category path, and no request in progress. It
navigates to `dashboard` with `replaceUrl` and removes `state`, `code`, and `scope` query
parameters. The route guard separately checks the stored spreadsheet and category-tab IDs.[^guards]

# Failure behaviour

Creation, tab setup, category reads, and category saves show visible errors and stop progress.
A category-read failure does not expose an empty-sheet draft. Known-file Retry keeps the ID;
tab retries read fresh metadata and reuse existing tabs. Save retries read persisted names
and append only missing accepted names, including when a write response was lost. Failed
final reads follow the same recovery path. Drafts and accepted lists stay local to this visit;
this is not a transaction across concurrent editors.

If creation fails without a usable ID, the page explains that a spreadsheet might exist and
offers Choose existing. Generic Retry never repeats that creation request. Setup requires
network access and does not use the expense outbox.[^setup]

[^guards]: isSetupReady
[^picker]: PickerService
[^setuphtml]: Setup form template
[^setup]: SettingsPageContainer
[^report]: Category spending report
