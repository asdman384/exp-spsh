---
type: Flow
title: Manage categories
description: Add, reorder by drag, and delete-by-swipe on the categories page, including the optimistic reorder and its rollback.
tags: [flow, category, drag-drop, optimistic-update]
status: stable
generated: { by: claude_code/claude-opus-5-5, at: 2026-09-23T00:00:00Z }
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

# Entry and load

Route `#/dashboard/categories`, guarded by `isLoggedIn` and `isOnline`. The constructor
dispatches `loadCategories`, so the page always refreshes on entry.[^page]

`loadCategories$` → `values.get` on `categories!A:B` (`UNFORMATTED_VALUE`), mapped
`([name, position]) => ({ name, id: position })`, `[]` when empty → `storeCategories`, which
`saveCategories$` persists.[^effects]

While `loading` is true the Add button and drag-and-drop are disabled.

# Add

`addCategory(name, control)`:

1. `position = max(ids, -1) + 1`;
2. a duplicate `name` is logged and ignored;
3. reset the input; dispatch `addCategory({ newCategory: { name, id: position } })`.

`addCategory$` → `values.append` on `categories!A1:B1` (`INSERT_ROWS`, `RAW`) → store
`[...categories, newCategory]`.

# Reorder

`onDrop` tries delete first, otherwise moves the item in a copy and dispatches
`updateCategoryPosition`. The effect is **optimistic**: it saves the old array in a
`Memento`, stores the new order, then `values.update`s `categories!A1:B<n>` (`RAW`) with
`[[name, id], …]` in the new order — each row keeps its original `id`.

On failure it restores the saved order and shows "Couldn't save the new order. Your
categories were put back the way they were."

# Delete (drag right)

A drop that did not change position and moved more than 150 px right deletes. While dragging,
the placeholder reads "Drop to remove" when `distance.x > 150` and `distance.y < 23`.

`deleteCategory$` finds the index by name (throws `cannot find category [name]` if absent),
calls `deleteSheetRow(categoriesSheetId, index)`, then stores the array without it. The store
index is used as the sheet row index, which holds because the page reloads from the sheet on
entry.

Deleting a category leaves historical expenses that reference its name untouched.

[^page]: CategoriesPageContainer
[^effects]: The four category effects
