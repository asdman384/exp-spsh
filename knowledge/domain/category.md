---
type: Domain Entity
title: Category
description: A user-defined spending category with an explicit ordering position, stored one per row on the `categories` sheet.
tags: [domain, category, model]
status: stable
generated: { by: claude_code/claude-opus-5, at: 2026-09-05T00:00:00Z }
sources:
  - id: model
    resource: ../../src/shared/models/category.ts
    title: Category interface
  - id: page
    resource: ../../src/modules/dashboard/categories/categories-page.container.ts
    title: CategoriesPageContainer
  - id: svc
    resource: ../../src/services/spreadsheet/spreadsheet.service.ts
    title: SpreadsheetService category methods
---

# Schema

```ts
interface Category {
  name: string;   // the natural key
  id: number;     // ordering position, NOT a database id
}
```

`id` is a **position**, despite the name. New categories are assigned
`Math.max(...categories.map(c => c.id), -1) + 1`, so the first category gets `0`.[^page]

# Storage

One row on the `categories` sheet: column **A = `name`**, column **B = `id`**. Column B
carries a `NUMBER_GREATER_THAN_EQ 0` data validation.[^svc]

The whole sheet is read with a single `values.get` over `categories!A:B`, and the array
order returned by the API — *row order*, not `id` order — is what the app displays. Nothing
sorts by `id` at read time.

# Identity and uniqueness

`name` is the key:

- `Expense.category` stores the **name string**, not the numeric position, so renaming a
  category would orphan historical expenses. There is no rename feature.
- `CategoriesPageContainer.addCategory` rejects a duplicate name client-side (it logs
  `category [x] already exists` and returns without dispatching).
- `deleteCategory$` locates the row by `findIndex(c => c.name === ...)` and deletes that
  row index, throwing `cannot find category [name]` when absent.
- The dashboard's category `<mat-select>` tracks by `category.name`.

# Reordering

Drag-and-drop reordering rewrites the **entire** `categories!A1:B<n>` range with
`values.update` (`valueInputOption: RAW`), reassigning nothing — the array order carries the
meaning and each row keeps its original `id`. See [manage categories](/flows/manage-categories.md).

# Referential integrity

The data sheets enforce the link at the spreadsheet level: column A of every `data_*` sheet
has a `ONE_OF_RANGE` validation against `=categories!$A:$A`, so a value typed directly in
Google Sheets must be an existing category name.

[^page]: CategoriesPageContainer
[^svc]: SpreadsheetService category methods
