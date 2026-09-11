---
type: Flow
title: Manage categories
description: Add, reorder by drag, and delete-by-swipe on the categories page, including the optimistic reorder and its rollback gap.
tags: [flow, category, drag-drop, optimistic-update]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: page
    resource: ../../src/modules/dashboard/categories/categories-page.container.ts
    title: CategoriesPageContainer
  - id: effects
    resource: ../../src/@state/app.effects.ts
    title: loadCategories$ / addCategory$ / deleteCategory$ / updateCategoryPosition$
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService category methods
---

# Entry

Route `#/dashboard/categories`, guarded by `isLoggedIn` **and `isOnline`**. The container
dispatches `loadCategories` in its constructor, so the page always refreshes from the
spreadsheet on entry.[^page]

# Load

`loadCategories$` -> `getAllCategories()` -> `values.get` on `categories!A:B` with
`valueRenderOption: UNFORMATTED_VALUE`, mapped as `([name, position]) => ({ name, id: position })`.
A missing `values` array yields `[]`. The result is stored *and* persisted to localStorage by
`saveCategories$`.[^effects]

# Add

The input plus **Add** button calls `addCategory(name, control)`, which:

1. takes the current categories once, computes `position = max(id, -1) + 1`;
2. rejects a duplicate `name` with a log line and no dispatch;
3. resets the input control and dispatches `addCategory({ newCategory: { name, position } })`.

`addCategory$` calls `values.append` on `categories!A1:B1` with
`insertDataOption: INSERT_ROWS`, `valueInputOption: RAW`, then appends the new category to
the in-store array (`[...categories, newCategory]`) — append-at-end, matching the sheet.

# Reorder (drag)

The list is a `cdkDropList`. `onDrop` first asks `tryDelete`, and otherwise calls
`changePosition`, which `moveItemInArray`s a copy and dispatches `updateCategoryPosition`.

`updateCategoryPosition$` is **optimistic**: it saves the previous array in a field
`categoriesBackUp`, dispatches `storeCategories` with the new order immediately, then calls
`updateCategories(...)` -> `values.update` on `categories!A1:B<n>` (RAW), rewriting the whole
range as `[[name, id], ...]` in the new visual order.

> **On a failed reorder**, the `catchError` branch dispatches
> `AppActions.storeCategories({ categories: this.categoriesBackUp })` to restore the
> pre-reorder order, alongside `loading(false)` and
> `operationFailed({ source: 'updateCategoryPosition$', message: "Couldn't save the new
> order. Your categories were put back the way they were." })`, which opens a snackbar. Note:
> after the *first* failed reorder in a session, `updateCategoryPosition$`'s stream is
> complete and further reorders silently do nothing at all — see
> [known issues](../constraints/known-issues.md) item 21.

# Delete (drag right)

`tryDelete` fires when the drop **did not change position**
(`previousIndex === currentIndex`) and the horizontal distance exceeds
`DELETE_THRESHOLD = 150` px. While dragging, `cdkDragMoved` shows the placeholder text
"Drop to remove" when `distance.x > 150 && distance.y < MOVE_THRESHOLD (23)`.

`deleteCategory$` finds the index by name in the store array, throws
``cannot find category [name]`` if absent, splices a copy, and calls
`deleteSheetRow(categoriesSheetId, index)`. **The store array index is used directly as the
sheet row index**, which holds only while the store mirrors the sheet's row order — true
right after `loadCategories`, and the reason this page reloads on entry.

Deleting a category does **not** touch historical expenses that reference it by name; the
sheet-level `ONE_OF_RANGE` validation only constrains new manual entry.

[^page]: CategoriesPageContainer
[^effects]: The four category effects
