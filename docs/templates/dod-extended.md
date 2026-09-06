# Definition of Done (extended) — <feature> (`<slug>`)

Spec: `docs/specs/<slug>.md`
Architecture note: `docs/architecture/<slug>.md`
Created: <YYYY-MM-DD>

Use this instead of `dod-minimal.md` when the slice touches **any** of:

- the spreadsheet column layout or tab structure (users already have data in the current shape)
- OAuth scopes, the auth strategy, or token storage
- credentials (`keys.json`, CI secrets)
- the service worker, caching, or offline behaviour
- anything that deletes or overwrites rows in a user's spreadsheet

Sections 1–6 are ticked by the orchestrator from cited evidence. Section 7 is **human-only**.

---

## 1. Acceptance criteria

- [ ] [AC1] <criterion text, copied from the spec> — covered by `<path::test name>` — <passing|failing|not written>
- [ ] [AC2] ...

## 2. Verification layers

- [ ] **Build / type-check** — `bash scripts/harness.sh --build` exits 0
- [ ] **Unit tests** — `bash scripts/harness.sh --test` exits 0, no new skipped suites
- [ ] **Full harness** — `bash scripts/harness.sh` exits 0

## 3. Data safety

The datastore is a spreadsheet the user owns and edits by hand. This section is why this
template exists.

- [ ] Every write path names the rows it touches, and that set is what the spec intended
- [ ] No path can delete or overwrite a row the user did not act on
- [ ] Row-index arithmetic re-reads before it writes, and the read-to-write window is stated
- [ ] Behaviour with a concurrent edit in Google Sheets is described (even if the answer is
      "last write wins, accepted")
- [ ] Date conversion unchanged, or the shift in stored values is stated and intended
- [ ] Tested against a **scratch spreadsheet**, never against real expense data

## 4. Compatibility with existing spreadsheets

- [ ] Column layout change is reflected in **all three** places it is encoded: `addExpense`,
      the `A1:E{n}` ranges, and the gviz `select`
- [ ] Spreadsheets created by the previous version still load, or the upgrade path is written down
- [ ] `setDataSheetFormats` / `setCategoriesSheetFormats` updated if validations changed
- [ ] Stale `localStorage` from the previous version does not break boot
      (`src/@state/app.reducers.ts` rehydrates synchronously and throws on bad JSON)

## 5. Credentials and scopes

- [ ] No credential value appears in source, in a commit, in a log line, or in an agent transcript
- [ ] `keys.json` still gitignored; `keys.example.json` updated if a new key is required
- [ ] OAuth scope change is stated, with why the narrower scope does not suffice
- [ ] CI secrets updated in the repository settings if a key was added or rotated
- [ ] Google Cloud console changes recorded (redirect URIs, enabled APIs, consent screen)

## 6. Failure behaviour

- [ ] Every new failure path either surfaces to the user or is deliberately silent, and the
      choice is stated (the codebase currently swallows all errors — silence is a decision here,
      not a default)
- [ ] Offline behaviour stated: does the operation queue, fail, or get blocked by a guard?
- [ ] Rollback path for any optimistic update actually dispatches

## 7. Human-only

No agent ticks anything in this section.

- [ ] Requested by: <name>
- [ ] Architecture note reviewed by: <name>, <YYYY-MM-DD>
- [ ] DoD approved by: <name>, <YYYY-MM-DD>  ← **the gate**
- [ ] Manual check in the running app: <what was clicked, what was observed>
- [ ] Verified against a scratch spreadsheet by: <name>
- [ ] Change reviewed and accepted by: <name>
- [ ] Version bumped in `package.json`
