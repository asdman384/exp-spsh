# Continuation policy (defaults)

The knobs that bound an `orchestrator` run. In force unless the invoking human overrides
them; the orchestrator states which policy it is running under in its first log line.

A budget bounds **cost**. It is not evidence the result is good. Continue only when the next
action is expected to produce new evidence or close a named uncertainty — never to use up
remaining iterations.

## Knobs

| Knob | Default | Meaning |
| ---- | ------- | ------- |
| Max iterations | 6 | One iteration = one delegation plus the DoD update that follows it. |
| WIP | 1 | One subagent at a time, in sequence. Never parallel. |
| Progress signal | count of `[x]` in `docs/dod/<slug>.md` | The only accepted measure of progress. Not "it feels closer". |
| No-progress rule | signal unchanged for 2 consecutive iterations → stop | Two runs that tick nothing means the loop is not converging. |
| Oscillation rule | same agent + same task twice, or A → B → A → stop | Re-delegating with unchanged input is not a retry, it is a loop. |
| Escalation | log open items and blocking evidence, report to human | Stopping early with a clear account beats a green claim without evidence. |

## Stop conditions

Stop and report when **any** of these is true:

1. Every non-human DoD item is `[x]`. *(success)*
2. Only Human-only items remain. *(correct exit — a human takes it from here)*
3. Max iterations reached.
4. The progress signal has not changed for two iterations.
5. The workflow oscillates.
6. A subagent reports a blocker it cannot resolve.
7. Contradictory evidence remains unresolved — for example, the tester reports passing and
   the harness reports failing. **The harness wins**; report the contradiction rather than
   picking the friendlier signal.
8. The work needs something the write policy denies (`angular.json`, `package.json` — see
   `policy/sprint-window.json`), or a new dependency.

## Evidence rules

- A DoD item is ticked only with a concrete pointer: a test name, a command result, or a
  report file. Never on a subagent's assertion alone.
- A failed harness run is **state**, not noise. Carry it into the log. Never overwrite it
  with a cleaner-looking rerun and never re-run "to see if it passes this time" without
  saying why the input changed.
- Human-only DoD items are never ticked by an agent, under any budget pressure.

## Cost note

The full harness runs a production build and the whole test suite (tens of seconds). Prefer
`bash scripts/harness.sh --test --include <path>` while iterating, and the full
`bash scripts/harness.sh` at handoff — the reviewer re-runs the full gate regardless.
