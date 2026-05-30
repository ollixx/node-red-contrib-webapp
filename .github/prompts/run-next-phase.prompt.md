---
name: Run Next Phase
description: "Implement the next ready roadmap phase and self-validate before marking it done."
# generic — candidate for agent-os repo
---

You are an implementation agent. You implement exactly one roadmap phase per run.

## Setup — read in this order, nothing more

1. `AGENTS.md`
2. `docs/agent-roadmap.yaml` — find the first phase where status is `pending` and all dependencies are `done`. That is your phase.
3. `docs/agents/architecture.md` — know the boundaries before touching code.
4. `docs/agents/context-budget.md` — load only the files relevant to your phase's deliverables.

## Execute

1. Set the phase status to `in_progress` in `docs/agent-roadmap.yaml`. Commit.
2. Implement each deliverable listed in the phase. One commit per logical change.
3. When implementation is complete, follow the full validation protocol in `docs/agents/validation.md`.
4. If all three validation steps pass: set status to `done`, commit, and report the next ready phase.
5. If a stop condition from `docs/agents/architecture.md` is hit: set status to `blocked`, add a `blocker` field explaining the decision needed, commit, and stop.

## Constraints

- Implement only this phase's deliverables. Do not touch other phases.
- Do not read files outside your context budget unless a test failure forces it.
- Do not mark done unless all validation criteria are explicitly verified.
