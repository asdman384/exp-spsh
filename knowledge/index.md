---
okf_version: "0.2"
---

# exp-spsh knowledge bundle

An OKF v0.2 knowledge bundle for **exp-spsh** — an Angular 21 PWA that records personal
expenses directly into a user-owned Google Spreadsheet, with no backend of its own.

Start with [the system overview](architecture/overview.md), then follow whichever section
matches the question you have. Every concept cites the source files it was derived from in
its `sources` frontmatter; paths are relative to the concept file and point into the
repository that contains this bundle.

# Architecture

* [exp-spsh system overview](architecture/overview.md) - What the app is, its layers, and the five choices that shape everything else.
* [NgRx state management](architecture/state-management.md) - The single `app` slice, reducer-versus-effect responsibilities, and localStorage hydration.
* [Routing and route guards](architecture/routing-and-guards.md) - The hash-based lazy route tree and the three guards that gate it.
* [Bootstrap and dependency wiring](architecture/dependency-wiring.md) - Providers, abstraction bindings, and the global `log()` side channel.
* [PWA, service worker, and caching](architecture/pwa-and-service-worker.md) - Installability, what is cached, the iOS patch, and update delivery.

# Domain

* [Expense](domain/expense.md) - The core record and its row mapping, including the "in debt" encoding.
* [Category](domain/category.md) - Name-keyed categories with an explicit ordering position.
* [Sheet, User, and Token](domain/sheet-and-user.md) - Tabs, the Google profile that names them, and token expiry.
* [Spreadsheet layout and date encoding](domain/spreadsheet-layout.md) - The authoritative column schema and both date encodings.
* [Project glossary](domain/glossary.md) - Terms that mean something specific here, including the misleading names.

# Flows

* [Authentication and token lifecycle](flows/authentication.md) - Redirect and popup OAuth strategies, refresh, and logout.
* [Initial setup](flows/initial-setup.md) - Binding a spreadsheet, creating tabs, applying validations.
* [Add an expense](flows/add-expense.md) - Form to inserted row, then a one-day re-read.
* [Delete an expense](flows/delete-expense.md) - Swipe gesture, optimistic removal, index resolution, rollback.
* [Load expenses](flows/load-expenses.md) - The single read path, its date windows, and the online gate.
* [Manage categories](flows/manage-categories.md) - Add, reorder, and delete-by-swipe.
* [Monthly statistics and drill-down](flows/statistics.md) - Client-side aggregation and the View Transitions animation.
* [Offline behaviour and app updates](flows/offline-and-updates.md) - What works without a network, and how new versions arrive.

# Interfaces

* [Google Sheets v4 REST interface](interfaces/google-sheets-api.md) - Every Sheets call, with parameters.
* [Google Visualization Query (gviz/tq)](interfaces/gviz-query.md) - The query endpoint behind all filtered reads.
* [Google Identity and OAuth endpoints](interfaces/google-oauth.md) - GIS clients, token exchange, and console prerequisites.
* [ExpAuthInterceptor](interfaces/http-auth-interceptor.md) - The single HTTP choke point.
* [NgRx action surface](interfaces/ngrx-actions.md) - The complete internal action contract.
* [ExpensesTableComponent](interfaces/expenses-table-component.md) - Inputs, outputs, dynamic columns, drag gesture.
* [localStorage keys](interfaces/local-storage.md) - Every persisted key and its round-trip caveats.

# Systems

* [exp-spsh web application](systems/exp-spsh-app.md) - The deployed artifact and its runtime assumptions.
* [Google Sheets and Identity (the backend)](systems/google-workspace.md) - The external system that stores the data.
* [GitHub Actions and GitHub Pages](systems/github-pages.md) - Build, secrets, hosting, and the URL contract.
* [Development toolchain](systems/toolchain.md) - Versions, builders, and the local platform.

# Operations

* [Build and run locally](operations/build-and-serve.md) - The two-terminal loop and the runtime flags.
* [Testing](operations/testing.md) - How tests run and what is really covered.
* [CI and deployment](operations/ci-and-deployment.md) - Release checklist, rollback, and pipeline gaps.
* [Configuration and secrets](operations/configuration-and-secrets.md) - keys.json, environments, constants.
* [Troubleshooting](operations/troubleshooting.md) - Symptom-to-cause table.

# Constraints

* [Working agreements and agent policy](constraints/working-agreements.md) - Mandatory rules, permissions, write-scope policy.
* [Technical constraints](constraints/technical-constraints.md) - Hard couplings and invariants a change must respect.
* [Security posture](constraints/security-posture.md) - What backend-less implies, stated plainly.
* [Code conventions](constraints/code-conventions.md) - How to write code that matches what is here.
* [Known issues and rough edges](constraints/known-issues.md) - Defects found by reading the code, none of them fixed.

# References

* [Source map](references/source-map.md) - Directory-by-directory index of the repository.

# About this bundle

* Format: [OKF v0.2], a directory of markdown files with YAML frontmatter.
* Trust tier: **unverified** — every concept was generated by reading the repository at
  commit `78b5109`, and no concept carries a `verified` entry yet. Confirm a claim against
  its cited sources before relying on it for anything irreversible.
* History: [log.md](log.md).
