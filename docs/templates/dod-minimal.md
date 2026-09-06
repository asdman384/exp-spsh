# Definition of Done — <feature> (`<slug>`)

Spec: `docs/specs/<slug>.md`
Created: <YYYY-MM-DD>

Copy this file to `docs/dod/<slug>.md` and fill it in. Sections 1–3 are ticked by the
orchestrator from cited evidence. Section 4 is **human-only** — no agent may ever tick it.

An item without a concrete evidence pointer (a test name, a command result, a report file)
stays `- [ ]`. "I think it works" is not evidence.

---

## 1. Acceptance criteria

One line per `[AC*]` marker in the spec, in the same order and with the same numbering.
Each line ends with the test that proves it and that test's current state.

- [ ] [AC1] <criterion text, copied from the spec> — covered by `<path::test name>` — <passing|failing|not written>
- [ ] [AC2] ...
- [ ] [AC3] ...

## 2. Verification layers

The harness layers this slice touches. Delete rows that do not apply and say why.

- [ ] **Build / type-check** — `bash scripts/harness.sh --build` exits 0
- [ ] **Unit tests** — `bash scripts/harness.sh --test` exits 0, no new skipped suites
- [ ] **Full harness** — `bash scripts/harness.sh` exits 0 (this is the gate the reviewer re-runs)
- [ ] **Manual check in the running app** — only when the change is visible in the UI or
      touches the service worker. Two terminals: `npm run watch` and `npm run serve`, then
      http://localhost:4200/exp-spsh/. State what was clicked and what was observed.
      *An agent cannot tick this one — move it to section 4 if it applies.*

## 3. Explicitly out of scope

Copied from the spec's `Scope / Out:` list. These are ticked as *confirmed not done* — they
record that the omission was deliberate, not forgotten.

- [ ] <thing the spec said it would not do>
- [ ] <...>

## 4. Human-only

No agent ticks anything in this section. The chain stops when only these remain — that is a
correct exit, not a failure.

- [ ] Requested by: <name>
- [ ] DoD approved by: <name>, <YYYY-MM-DD>  ← **the gate; nothing past step 2 runs until this is signed**
- [ ] Change reviewed and accepted by: <name>
- [ ] Version bumped in `package.json` if this ships (it is the only user-visible release marker)
