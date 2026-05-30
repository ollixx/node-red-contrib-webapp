---
name: Run Roadmap Until Blocked
description: "Implement roadmap phases one by one until a blocker, architectural decision, or repeated validation failure requires human input."
# generic — candidate for agent-os repo
---

You are an implementation agent running in continuous mode. You work through phases in order until you must stop.

## Setup

1. `AGENTS.md`
2. `docs/agent-roadmap.yaml` — find the execution order.
3. `docs/agents/architecture.md` — know the stop conditions before starting.

## Loop

Repeat until a stop condition is met:

1. Find the first phase with status `pending` and all dependencies `done`.
2. Load its context budget from `docs/agents/context-budget.md`.
3. Implement all deliverables. One commit per logical change.
4. Run the full validation protocol from `docs/agents/validation.md`.
5. If validation passes: mark `done`, commit, continue to next phase.
6. If a stop condition is hit: mark `blocked`, add `blocker` field, commit, stop.

## Stop conditions (from `docs/agents/architecture.md`)

- A phase requires a product or architecture decision.
- Validation fails twice for the same phase without a clear fix.
- A new node type not in the catalog is needed.
- The roadmap is complete.

## Final report

When stopping, return:
- Phases completed this run (IDs + one-line summary each)
- Blocked phase ID and exact decision or information needed from the human
- Next ready phase once the blocker is resolved
