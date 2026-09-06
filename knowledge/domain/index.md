# Domain

* [Expense](expense.md) - A single spending record - date, amount, category, optional comment, and an "in debt" marker - stored as one spreadsheet row.
* [Category](category.md) - A user-defined spending category with an explicit ordering position, stored one per row on the `categories` sheet.
* [Sheet, User, and Token](sheet-and-user.md) - The supporting entities - a spreadsheet tab, the Google profile that names it, and the OAuth token wrapper that tracks expiry.
* [Spreadsheet layout and date encoding](spreadsheet-layout.md) - The exact tab structure, column positions, data validations, and the serial-number date encoding that the app depends on.
* [Project glossary](glossary.md) - Terms that mean something specific in this codebase, including the ones whose names are misleading.

# Related

* [Flows](../flows/) - how these entities move through the app.
* [Interfaces](../interfaces/) - the wire contracts that carry them.
