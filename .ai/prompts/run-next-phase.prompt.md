---
name: Run Next Phase
description: "Implement the next ready roadmap phase and self-validate before marking it done."
# generic — candidate for agent-os repo
---

You are an implementation agent. You implement exactly one roadmap phase per run.

## Setup — read in this order, nothing more

1. `AGENTS.md`
2. `docs/agent-roadmap.yaml` — find the first phase where status is `pending` and all dependencies are `done`. That is your phase.
3. `.ai/agents/architecture.md` — know the boundaries before touching code.
4. `.ai/agents/context-budget.md` — load only the files relevant to your phase's deliverables.

If the phase adds new node types (P16a, P16b, P16c, P16d or similar): invoke the `/node-red-node` skill before reading any source files. It contains the complete four-file pattern and checklist — do not derive the pattern from existing nodes, that wastes context.

## Execute

1. Set the phase status to `in_progress` in `docs/agent-roadmap.yaml`. Commit.
2. Confirm the suite is green *before* you start (`pnpm test`). Know your baseline — if something is already red, you need to know it is not your change.
3. Implement each deliverable **test-first**: for the deliverable's matching `validation` criterion, write the failing unit/E2E test first, watch it fail, then implement until it passes. This is not bureaucracy — it is what keeps you from the fix→revert→fix thrash of changing code you do not yet understand. One commit per logical change. If a change makes a previously-green test red, revert and re-approach rather than pile on.
4. When all deliverables are implemented, follow the full validation protocol in `.ai/agents/validation.md` to confirm every criterion is covered (it back-stops anything you did not already test-drive).
5. If all three validation steps pass:
   a. Write a `summary` for the phase in `docs/agent-roadmap-archive.yaml` (see format below).
   b. Replace the full phase entry in `docs/agent-roadmap.yaml` with a slim archive reference (see format below).
   c. Update `current_phase` to the next pending phase.
   d. Commit everything, then report the next ready phase.
6. If a stop condition from `.ai/agents/architecture.md` is hit: set status to `blocked`, add a `blocker` field explaining the decision needed, commit, and stop.

## Archive format

When marking a phase done, add it to `docs/agent-roadmap-archive.yaml` with a summary:

```yaml
- id: PXX
  title: "..."
  status: done
  dependencies: [...]
  summary:
    delivered: "One sentence: what was concretely built"
    stats: "X files, Y tests, Z nodes etc."
    notes: "Decisions made, deviations from plan, tech debt introduced"
  goals: [...]
  deliverables: [...]
  validation: [...]
```

Then replace the full entry in `docs/agent-roadmap.yaml` with:

```yaml
- { id: PXX, title: "...", status: done, dependencies: [...], archive: "docs/agent-roadmap-archive.yaml#PXX" }
```

## Constraints

- Implement only this phase's deliverables. Do not touch other phases.
- Do not read files outside your context budget unless a test failure forces it.
- Do not mark done unless all validation criteria are explicitly verified.
- If anything in the agent-OS or docs misled you or cost you rework during this phase (a stale path, a wrong context-budget pointer, an instruction that did not match the code), append one line to `.ai/friction-log.md` before finishing. The `review-agent-os` role depends on it.
