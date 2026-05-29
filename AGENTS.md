# Project Guidelines

## Working Mode

- This repository is plan-first until the initial scaffold exists.
- Read [prd.md](prd.md), [docs/implementation-plan.md](docs/implementation-plan.md), and [docs/agent-roadmap.yaml](docs/agent-roadmap.yaml) before making implementation changes.
- Work on exactly one roadmap phase at a time.
- Update roadmap status in [docs/agent-roadmap.yaml](docs/agent-roadmap.yaml) whenever a phase starts, completes, or becomes blocked.
- Always read the AGENT.md before answering any prompt

## Context discipline — read only what you need

Token cost is real. Do not read files speculatively. Follow this order:

1. Read `AGENTS.md` (this file) and the current phase entry in `docs/agent-roadmap.yaml` only.
2. For each deliverable, identify the minimum set of files to read: the relevant `docs/nodes/<node>.md`, the corresponding editor HTML, schema type, and runtime handler. Read those. Do not read unrelated nodes.
3. When writing tests, read the existing test file for the package first to match conventions — do not read all test files.
4. Do not read files you have already read in this session unless you need to re-check a specific line.
5. Use `grep` to locate symbols before reading whole files. A targeted grep is cheaper than reading 300 lines to find one function.

## Architecture Defaults

- Build the project as a TypeScript workspace.
- Keep shared contracts in a dedicated package so editor, runtime, and renderer use the same schema.
- Treat the UI registry as the source of truth for rendered structure.
- Keep structure, runtime event flow, and editor UX in separate modules.

## Delivery Rules

- Prefer small, phase-aligned changes over broad scaffolding with unclear ownership.
- Validate each phase with runnable checks before marking it done.
- If a phase uncovers an unresolved architecture decision, write it down and stop instead of guessing.
- Keep the CRUD example app current with the MVP as soon as runtime and renderer pieces exist.

## Commits first
- Before working on new code, make sensitive commits with a short, but meaningful comment.
- Before committing and after finishing any coding work, always run the full test suite (`pnpm test`), all E2E-Tests and fix all failures before proceeding

## Self-Validation Protocol

No human reviews PRs. The agent is responsible for verifying its own work before marking a phase done. Complete all three steps — in order — before updating the phase status to done.

### Step 1: Tests must be green

Run the full test suite and all E2E tests. Fix every failure before proceeding. No exceptions.

```
pnpm test
pnpm exec playwright test
```

### Step 2: Write and verify tests for every validation criterion

Open `docs/agent-roadmap.yaml` and find the `validation` list for the current phase. For each criterion, **write the test first if it does not exist**, then verify it passes:

- If it says **unit test**: write the test in the appropriate `test/` directory, then run it. The test must assert the exact behavior described in the criterion — not a weaker proxy.
- If it says **Playwright**: write an E2E test in `tests/e2e/` that exercises the described scenario end to end in a real browser against a running Node-RED instance, then run it.
- If it says **docs check**: read the referenced doc file and the referenced source file side by side. Confirm they match. If they diverge, fix the implementation or the doc — whichever is wrong. No test needed, but the check must be explicit and documented in the commit message.

Do not skip a criterion. Do not mark it done by assumption. Every criterion must be explicitly verified.

### Step 3: Cross-check implementation against spec docs

For every node type touched in the phase, read its `docs/nodes/<node>.md` file and compare it against the implementation:

1. Every **Pflichtfeld** listed in the doc has a corresponding required field in the editor HTML and in the schema.
2. Every **Optionales Feld** listed in the doc has a corresponding optional field in the editor HTML.
3. Every **parent** description in the doc matches the set of node types offered in the editor SelectBox.
4. Every **Output** event listed in the doc has a corresponding handler in `nodes/webapp.js` or the runtime.

If a discrepancy is found: fix it. If the doc is ahead of the implementation (speculative feature), leave it — do not implement speculative features unless they are in the current phase's deliverables.

### Only after all three steps pass: commit and mark done

Update `docs/agent-roadmap.yaml` status to `done` for the phase. Then commit.
