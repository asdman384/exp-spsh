---
name: validate-decompose-spec
description: "Use when starting work that needs a standardized artifact, decomposition, and approval before code or real effects."
argument-hint: "Feature description or user story"
---

## When this applies

- New feature spanning multiple behaviors, contracts, or modules
- Work that touches money, DB schema, auth, or state machines
- Any task where the prompt is abstract enough that you'd need to make architectural decisions
- "Implement [feature]", "Add [capability]", "Build [system]" — anything bigger than a targeted fix

## Core principle

Do not write code until the human has approved what you're about to build. The cost of a wrong plan is minutes; the cost of wrong code is hours.

## Before writing any code, run these stages

### 1. Assess — what artifact and proof will this need?

Choose the standard form: feature/story spec, task brief, investigation record, decision record, migration/operational plan, or handoff record. Set its depth from consequence, uncertainty, dependency stability, required evidence, and recovery needs.

**Stop and wait for approval before continuing.**

### 2. Decompose — break it into reviewable pieces

Only when the drivers call for it — consequence of a wrong claim, dependency weight, or a weak checking method. A low-consequence change against stable contracts can stay whole. Each subtask must be:
- Independently reviewable — produces a working, testable unit
- Coherent and resumable — leaves an exact result, terminal, evidence, and next safe action
- Assigned its own claim, consequence, and required checks
- Ordered by dependency — what blocks what, what can run in parallel

Present as a table: Stage | Outcome | Boundary | Required Evidence | Depends on | Parallel?

**Stop and wait for approval before continuing.**

### 3. Spec — lock in decisions before implementing

When behavior, interfaces, invariants, scope, or acceptance would otherwise be invented during execution, write a spec covering:
- **Goal** — what changes and why (one paragraph)
- **Assumptions** — what we believe but haven't verified, with what breaks if wrong
- **Modules and interfaces affected** — which modules this touches, what happens at each interface (none / extended / breaking), how each interface is tested
- **Approach** — stages + data flow or state machine diagram (Mermaid preferred)
- **Decisions** — alternatives considered, choice made, why
- **Scope boundaries** — explicit NOT-included list (this is the primary defense against over-generation)
- **Risks** — what could go wrong, mitigations
- **Open questions** — things to resolve before implementing

