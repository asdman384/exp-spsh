# Interfaces

# Outbound (network)

* [Google Sheets v4 REST interface](google-sheets-api.md) - Every Sheets API call the app makes, with endpoint, parameters, and the SpreadsheetService method that wraps it.
* [Google Visualization Query (gviz/tq) interface](gviz-query.md) - The query endpoint used for all filtered expense reads, its query string, response shape, and parsing rules.
* [Google Identity and OAuth endpoints](google-oauth.md) - The GIS client objects and raw OAuth/userinfo endpoints, with the exact parameters used.

# Internal

* [ExpAuthInterceptor](http-auth-interceptor.md) - The single HTTP choke point - it refreshes a token before every request and attaches the bearer header.
* [NgRx action surface](ngrx-actions.md) - The complete `App shell` action group - payloads, who dispatches each action, and what consumes it.
* [ExpensesTableComponent](expenses-table-component.md) - The shared table used by both the dashboard and statistics - inputs, outputs, dynamic column rules, and the drag gesture.

# Local persistence

* [localStorage keys](local-storage.md) - Every key the app persists in the browser, what writes it, what reads it, and the JSON round-trip pitfalls.
