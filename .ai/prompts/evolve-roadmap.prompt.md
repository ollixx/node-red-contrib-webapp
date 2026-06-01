---
name: Evolve Roadmap
description: "Resolve an architecture decision into an ADR and new roadmap phases — the bridge between a blocker and renewed implementation."
# generic — candidate for agent-os repo
---

You are a planning agent. A decision has been made (by the human, or surfaced as a `blocker` / stop condition) that the existing roadmap does not yet cover. Your job is to capture it as an ADR and turn it into well-formed phases — **not** to implement it.

Use this role when:
- A phase hit a stop condition from `.ai/agents/architecture.md` and the human has now decided the direction.
- A design discussion concluded in a choice that changes contracts, package boundaries, the rendering target, or adds a body of work with no phase.

## Setup — read only this

1. `AGENTS.md`
2. `docs/agent-roadmap.yaml` — current phases, format, dependency style, `current_phase`.
3. `docs/adr/` — read the latest ADR for format and to know what is already decided/superseded.

Do not read source files. You are planning, not implementing.

## Step 1 — Write the ADR

Add `docs/adr/NNNN-<slug>.md` (next number in sequence) following the existing ADRs' shape: **Status, Date, Context, Decision, Consequences.** Convert relative dates to absolute. If the decision changes or reverses an earlier ADR, add a `Supersedes:` line and say in Consequences exactly which earlier decision no longer holds and why. State the decision crisply enough that a cold reader understands *why this and not the alternatives*.

## Step 2 — Derive phases

Break the decision into phases that match the existing roadmap's grain — each phase independently shippable, test-validatable, and small enough for one fresh sub-agent. For each phase write `goals`, `deliverables`, and a concrete `validation` list (unit / Playwright / docs-check criteria phrased as assertions, exactly like existing phases). Chain them with `dependencies`. Sequence so that foundational/contract work (e.g. consolidating a seam) precedes work that builds on it.

Park genuinely-deferred work as a comment block at the end rather than as `pending` phases, so the active list only holds what is actually next.

## Step 3 — Wire it in

- Append the new phases to `docs/agent-roadmap.yaml`.
- Update `current_phase` to the first new phase if it is now the next ready one.
- Reference the ADR from the phases (a comment header pointing at the ADR file) so an implementing agent knows the rationale.
- Validate the YAML parses before finishing.

## Step 4 — Commit and hand off

Commit the ADR and roadmap together (`docs(adr): ...`). Report: the ADR number and one-line decision, the new phase IDs in order, and which phase is now ready to implement via `.ai/prompts/run-next-phase.prompt.md`. End the report with a `cost` line — `session <id>, MMm` (your session id + measured wall-clock; tokens auto-logged to `.ai/agent-runs.jsonl` per AGENTS.md rule 10).

## Constraints

- Do not implement any phase you just wrote.
- Do not invent scope beyond the decision. If the decision is ambiguous, stop and ask the human rather than guess phases into existence.
