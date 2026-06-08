---
name: Run Next Phase
description: "Implement the next ready roadmap phase and self-validate before marking it done."
# generic — candidate for agent-os repo
---

You are an implementation agent. You implement exactly one roadmap phase per run.

## Mode — standalone vs orchestrated

You run in one of two modes. The spawning instruction tells you which; if nothing says "ORCHESTRATED mode", you are standalone.

- **Standalone** (default): you own the roadmap for this phase. You do the full `Execute` sequence below, including every `docs/agent-roadmap.yaml` / archive write.
- **Orchestrated**: an orchestrator owns the roadmap and works in the main checkout; you are in your own git worktree on branch `phase/<PHASE_ID>`. The division of labour is strict:
  - The orchestrator has ALREADY set this phase `in_progress` — **do not** set it (skip Execute step 1's status write; still capture your start timestamp for the cost figure).
  - You **never** edit `docs/agent-roadmap.yaml` or `docs/agent-roadmap-archive.yaml`. Skip Execute step 5's roadmap writes entirely.
  - You implement, validate, and **commit only code** to your `phase/<PHASE_ID>` branch.
  - Instead of writing the archive, you **return** the summary as text (the `archive-summary:` block the orchestrator prompt specifies) plus your branch name and the next pending phase. The orchestrator transcribes it and merges your branch.
  - On a stop condition: do not set `blocked` in the YAML yourself — report `blocked` + a `blocker:` line; the orchestrator records it.

Everything else in this prompt (green baseline, test-first, the validation protocol, the friction log) applies identically in both modes.

## Setup — read in this order, nothing more

1. `AGENTS.md`
2. `docs/agent-roadmap.yaml` — find the first phase where status is `pending` and all dependencies are `done`. That is your phase.
3. `.ai/agents/architecture.md` — know the boundaries before touching code.
4. `.ai/agents/context-budget.md` — load only the files relevant to your phase's deliverables.

If the phase adds new node types (P16a, P16b, P16c, P16d or similar): invoke the `/node-red-node` skill before reading any source files. It contains the complete four-file pattern and checklist — do not derive the pattern from existing nodes, that wastes context.

If the phase **builds or changes a `ui-*` node**: its tests follow `.ai/agents/node-testing.md` — write the node's tests **fresh** to that standard (unit + Playwright, outcome-based, per-node test-flow + catalogue `.md`) and **discard the node's old tests**. This does NOT apply to cross-cutting/feature tests.

## Execute

1. Set the phase status to `in_progress` in `docs/agent-roadmap.yaml`. Commit. **At this moment capture your start timestamp** (`date -u +%FT%TZ`) — you need it for the `cost.duration` field at the end (AGENTS.md rule 10). *(Orchestrated mode: the orchestrator already set `in_progress` — skip the status write and commit, but still capture the timestamp.)*
2. Confirm the suite is green *before* you start (`pnpm test` **and** `pnpm exec playwright test`). Both must be fully green before you write a single line of implementation code. If any test is already failing: **stop, fix it first, commit the fix, then start the phase.** Do not proceed with a red baseline — a red baseline is a blocker, not a footnote.
3. Implement each deliverable **test-first**: for the deliverable's matching `validation` criterion, write the failing unit/E2E test first, watch it fail, then implement until it passes. This is not bureaucracy — it is what keeps you from the fix→revert→fix thrash of changing code you do not yet understand. One commit per logical change. If a change makes a previously-green test red, revert and re-approach rather than pile on.

   **Anti-baseline rule:** "pre-existing", "unrelated", "net improvement", and "baseline" are never valid reasons to leave an E2E test failing. If your change broke a test that was green before your phase: fix it. If a test was already red when you arrived: you should have stopped in step 2. If you discover mid-phase that there were pre-existing failures you missed in step 2: stop, fix them all, then continue. Zero E2E failures is the only valid state for marking done.
4. When all deliverables are implemented, follow the full validation protocol in `.ai/agents/validation.md` to confirm every criterion is covered (it back-stops anything you did not already test-drive).
5. If all three validation steps pass:
   - **Standalone:**
     a. Write a `summary` for the phase in `docs/agent-roadmap-archive.yaml` (see format below).
     b. Replace the full phase entry in `docs/agent-roadmap.yaml` with a slim archive reference (see format below).
     c. Update `current_phase` to the next pending phase.
     d. Commit everything, then report the next ready phase.
   - **Orchestrated:** do NOT touch the roadmap files. Commit your code to `phase/<PHASE_ID>`, then return the result block (the `archive-summary:` fields, branch name, next pending phase) for the orchestrator to transcribe and merge.
6. If a stop condition from `.ai/agents/architecture.md` is hit: **standalone** — set status to `blocked`, add a `blocker` field, commit, and stop. **Orchestrated** — do not edit the YAML; report `blocked` + a `blocker:` line to the orchestrator and stop.

## Archive format

When marking a phase done, add it to `docs/agent-roadmap-archive.yaml`. Entries live **under the top-level `phases:` key**, so the `- id:` bullet is indented **two spaces**, and every field below it indents from there. Match the indentation of the entries already in the file exactly — appending at column 0 produces a file that does not parse, which has happened before and went unnoticed.

```yaml
  - id: PXX
    title: "..."
    status: done
    dependencies: [...]
    summary:
      delivered: "One sentence: what was concretely built"
      stats: "X files, Y tests, Z nodes etc."
      notes: "Decisions made, deviations from plan, tech debt introduced"
      cost: "session <id>, MMm"   # your session_id + measured wall-clock; token totals auto-logged to .ai/agent-runs.jsonl keyed by session_id (AGENTS.md rule 10)
    goals: [...]
    deliverables: [...]
    validation: [...]
```

Then replace the full entry in `docs/agent-roadmap.yaml` with (the slim entries there sit at the same two-space indent):

```yaml
  - { id: PXX, title: "...", status: done, dependencies: [...], archive: "docs/agent-roadmap-archive.yaml#PXX" }
```

**After editing either roadmap file, run the roadmap check before you commit** — a broken append is silent otherwise:

```
pnpm check:roadmap
```

It confirms both files parse and that every done phase has an archive entry (and vice versa) with a summary. It is also part of `pnpm validate`, so the phase-done validation catches a broken roadmap automatically.

## Constraints

- Never end your run with a phase left `in_progress` while code is already committed. Standalone: finish the close-out (validate → status `done` → archive → slim → `current_phase`) before you stop or pivot to anything else. Orchestrated: report `done`/`blocked` back so the orchestrator closes it out. A phase that is "implemented but not closed out" has repeatedly been discovered later by inspection — do not create that state.
- Implement only this phase's deliverables. Do not touch other phases.
- Do not read files outside your context budget unless a test failure forces it.
- Do not mark done unless all validation criteria are explicitly verified.
- If anything in the agent-OS or docs misled you or cost you rework during this phase (a stale path, a wrong context-budget pointer, an instruction that did not match the code), append one line to `.ai/friction-log.md` before finishing. The `review-agent-os` role depends on it.
