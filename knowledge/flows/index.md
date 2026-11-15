# Flows

* [Authentication and token lifecycle](authentication.md) - How the redirect OAuth strategy obtains, refreshes, and revokes Google tokens, and how the popup strategy differs.
* [Initial setup](initial-setup.md) - Binding a spreadsheet to the app - picking it with Google Picker, tab discovery, tab creation, validation formatting, and the state that unlocks the dashboard.
* [Add an expense](add-expense.md) - From the dashboard form through the outbox to an inserted row, and the targeted re-read that follows.
* [Delete an expense](delete-expense.md) - Swipe-to-delete with an optimistic list update, a re-read to resolve the row index, and rollback on failure.
* [Load expenses](load-expenses.md) - Dashboard reads, date windows, the online gate, and independent Statistics reads.
* [Manage categories](manage-categories.md) - Add, reorder by drag, and delete-by-swipe on the categories page, including the optimistic reorder and its rollback.
* [Monthly statistics and drill-down](statistics.md) - Person/year/month selection, client-side aggregation by category, the drill-down into one category, and the View Transitions animation.
* [Offline behaviour and app updates](offline-and-updates.md) - What the app can and cannot do without a network, how online state is detected, and how a new deployment reaches an installed PWA.
* [Hold-to-record voice note](voice-recording.md) - The hold gesture, the in-memory clip, and how Gemini turns it into queued expenses.
* [Receipt photo recognition](receipt-recognition.md) - Editable receipt drafts and explicit confirmation.

# Related

* [NgRx state management](../architecture/state-management.md) - the effects that implement these flows.
* [Known issues](../constraints/known-issues.md) - the sharp edges these flows carry.
