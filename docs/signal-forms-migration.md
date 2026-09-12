# Dashboard form: migration to Signal Forms

`DashboardPageContainer`'s add-expense form was migrated from a template-driven `ngForm` /
`ngModel` form to Angular's experimental **Signal Forms** API (`@angular/forms/signals`,
Angular 21.2). This is the only form in the app that is no longer template-driven — see
[`knowledge/constraints/code-conventions.md`](../knowledge/constraints/code-conventions.md)
and [`knowledge/flows/add-expense.md`](../knowledge/flows/add-expense.md) for the updated
docs.

Both builds below are `ng build --configuration=production` on an otherwise-unchanged tree
(local machine, Angular CLI 21.2.11).

## What changed

- `expense: Expense` (plain mutable object) + a separate `sheet?: Sheet` field + `NgForm` →
  a single `expenseModel = signal<ExpenseFormModel>(...)` feeding `expenseForm = form(expenseModel, schemaFn)`.
- `required` validation moved from HTML attributes + `NgForm.valid` to a schema function
  calling `required()` on `date`, `sheet`, `amount`, `category`.
- `[(ngModel)]` on each Material control → `[formField]` (Signal Forms' directive binds a
  field to any `ControlValueAccessor`-based control, so `mat-select`, `mat-checkbox`, the
  datepicker input, and `matInput` needed no other change).
- `sheet` / `amount` / `category` are typed `T | null`, not `T | undefined`: Signal Forms'
  `Subfields` mapping treats a value type that includes `undefined` as "this field may not
  exist," which breaks `[formField]`'s typing and `required()`'s path argument. `null` does
  not trigger that.
- A static `required` attribute cannot coexist with `[formField]` on the same element — the
  compiler rejects it (`NG8022`). Those attributes were removed; Material's required-asterisk
  no longer renders on the affected controls, but validity is unaffected (it comes from the
  schema's `required()` calls, read via `expenseForm().valid()`).
- `form.resetForm({ date, sheet, ... })` on submit → `expenseForm().reset({ ...blank, date, sheet })`,
  same "keep date and person, clear the rest" behavior.

`FormsModule`/`NgForm` are gone from this component; `@angular/forms/signals` is a new
dependency for the dashboard lazy chunk (the `Expense`/`Sheet` models and NgRx wiring are
unchanged).

## Bundle size: before → after

### Initial (eagerly loaded) chunks

| Chunk | Raw before | Raw after | Δ raw | Transfer before | Transfer after | Δ transfer |
|---|---:|---:|---:|---:|---:|---:|
| **Initial total** | 967.00 kB | 969.64 kB | **+2.64 kB** | 243.98 kB | 244.43 kB | **+0.45 kB** |

The initial bundle is essentially flat — Signal Forms only reaches the app through the
lazy-loaded dashboard route, not the eager bundle.

### Lazy chunks

| Chunk (name) | Raw before | Raw after | Δ raw | Transfer before | Transfer after | Δ transfer |
|---|---:|---:|---:|---:|---:|---:|
| `dashboard-routes` | 351.60 kB | 382.76 kB | **+31.16 kB** | 65.29 kB | 73.16 kB | **+7.87 kB** |
| (unnamed vendor chunk) | 109.62 kB | 108.99 kB | −0.63 kB | 19.96 kB | 19.87 kB | −0.09 kB |
| `setup-routes` | 17.38 kB | 17.38 kB | 0 | 4.69 kB | 4.65 kB | −0.04 kB |
| `ngrx-store-devtools` | 11.81 kB | 11.81 kB | 0 | 3.99 kB | 4.00 kB | +0.01 kB |
| `logger` | 2.29 kB | 2.29 kB | 0 | 0.77 kB | 0.77 kB | 0 |
| everything else (5 tiny chunks) | 2.55 kB | 2.55 kB | 0 | 1.49 kB | 1.49 kB | 0 |
| **Lazy total** | 495.26 kB | 525.79 kB | **+30.53 kB** | 96.58 kB | 104.33 kB | **+7.75 kB** |

All of the growth lands in `dashboard-routes`, the chunk `DashboardPageContainer` lives in —
that's `@angular/forms/signals` (the `form`/`required`/`FormField` runtime) being pulled in
where `FormsModule` used to be.

### Grand total (initial + lazy)

| | Before | After | Δ | Δ % |
|---|---:|---:|---:|---:|
| Raw size | 1462.26 kB | 1495.43 kB | **+33.17 kB** | +2.3% |
| Estimated transfer | 340.56 kB | 348.76 kB | **+8.20 kB** | +2.4% |

## Verification

- `bash scripts/harness.sh --all` (lint, typecheck, `ng build --configuration=production`,
  `ng test --watch=false`) is green: 99 passed / 2 skipped, no lint or type errors.
- No `.spec.ts` exists for `DashboardPageContainer`, so no test file was touched.
- **Not verified in a browser.** The app has no backend of its own — every screen is gated
  behind a live Google OAuth sign-in against the user's own spreadsheet, which this session
  has no credentials for. The build and existing test suite pass, but the actual UI (date
  picker, selects, checkbox, submit, and the lost required-asterisk styling) has not been
  clicked through.

## Caveats

- Signal Forms (`@angular/forms/signals`) is **experimental** in Angular 21.2 (every symbol
  used carries `@experimental 21.0.0` / `21.2.0` in its type declarations) — its API can
  change in a later Angular release.
- The `[formField]` + `ControlValueAccessor` interop path used here is explicitly documented
  as a backwards-compatibility bridge ("should only be used for backwards compatibility with
  reactive forms"), not the primary way Signal Forms expects new controls to be built. A
  from-scratch Material replacement (implementing `FormValueControl`/`FormCheckboxControl`
  directly) isn't available in this Material version.
- Losing the native `required` attribute means Material's asterisk no longer shows next to
  Date/User/Amount/Category — a small visual regression from the template-driven version,
  worth a follow-up if the required-indicator matters.
