---
description: Run a feature end-to-end through the fixed agent chain — planner if the spec is missing, then implementer, tester, reviewer. Single pass.
argument-hint: <slug or feature description>
allowed-tools: Read, Grep, Glob, Write, Task, Bash
---

Deterministic chain for `$ARGUMENTS`. The sequence below is fixed — do not decide
it, do not reorder it, do not iterate. If the work needs judgement about what runs
next, or a fix-until-approved loop, stop and tell the human to use the
`orchestrator` agent instead.

Pick one kebab-case `<slug>` from `$ARGUMENTS` and use it for every path.

This repo is a single Angular 21 + NgRx PWA: `src/` and one `package.json` at the
root, verification via `bash scripts/harness.sh` (build + tests). No `backend/` or
`frontend/` split, no lint or typecheck script.

## Step 0 — spec

If `docs/specs/<slug>.md` exists, skip. Otherwise delegate to `planner` with the
feature description and wait for the file.

If the work changes the spreadsheet column layout, adds a Google API surface or
OAuth scope, changes the auth/token lifecycle, changes the store shape, or changes
offline behaviour — stop and tell the human to use the `orchestrator` agent, which
runs `architect` first. This command does not make that call.

## Step 1 — DoD gate

If `docs/dod/<slug>.md` exists and its Human-only section shows an approver, skip.

Otherwise: copy `docs/templates/dod-minimal.md`, fill section 1 from the spec's
`[AC*]` markers, section 2 from the harness layers this slice touches, section 3
from the spec's `Out:` list, section 4 with the requesting human. Write it to
`docs/dod/<slug>.md`, **stop, and ask for approval.** Do not continue in the same
run.

## Step 2 — implementer

Delegate to `implementer`. Pass the spec path and the DoD path — paths, not
contents. One concrete task naming the files and the acceptance criteria it must
close. Remind it that `tester` owns all test authorship.

## Step 3 — tester

Delegate to `tester`. Pass the spec path, the DoD path, and the implementer's
summary. Ask for one test per acceptance criterion in section 1 of the DoD, and
for the exact test pointers in its report.

## Step 4 — reviewer

Delegate to `reviewer`. Pass the spec path and the DoD path. It writes
`docs/reviews/<slug>.md`.

## Step 5 — DoD and log

Read the DoD once, now. Tick every item the reports demonstrate as passing, citing
the evidence inline — a test pointer, a command result, or a line from the review.
Never tick a Human-only item. Never tick anything without a concrete pointer.

Run `bash scripts/harness.sh --all` and record the result against DoD section 2.

Append to `docs/orchestrator-log/<slug>.md`:

```
[/orchestrate] <slug> — planner:<ran|skipped> implementer:<pass|fail> tester:<pass|fail> reviewer:<verdict>; DoD X/Y; harness <green|failed:layer>
```

## Report

Which agents ran, the reviewer's verdict, DoD count, and every item still open with
the reason. If any step failed, stop there and report — a single pass means no
retries.
