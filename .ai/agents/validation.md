# Self-Validation Protocol
<!-- generic — candidate for agent-os repo -->

No human reviews PRs. The agent is responsible for verifying its own work before marking a phase done. Complete all three steps — in order — before updating the phase status to `done`.

## Step 1: Tests must be green

Run the full test suite and all E2E tests. Fix every failure before proceeding. No exceptions.

```
pnpm test
pnpm exec playwright test
```

## Step 2: Write and verify tests for every validation criterion

Open `docs/agent-roadmap.yaml` and find the `validation` list for the current phase. For each criterion, **write the test first if it does not exist**, then verify it passes:

- **unit test**: write the test in the appropriate `test/` directory, then run it. The test must assert the exact behavior described — not a weaker proxy.
- **Playwright**: write an E2E test in `tests/e2e/` that exercises the described scenario end to end in a real browser against a running Node-RED instance, then run it.
- **docs check**: read the referenced doc file and the referenced source file side by side. Confirm they match. If they diverge, fix the implementation or the doc — whichever is wrong. Document the check explicitly in the commit message.

Do not skip a criterion. Do not mark it done by assumption.

## Step 3: Cross-check implementation against spec docs

For every node type touched in the phase, read its `docs/nodes/<node>.md` and compare against the implementation:

1. Every **Pflichtfeld** in the doc → required field in editor HTML and schema.
2. Every **Optionales Feld** in the doc → optional field in editor HTML.
3. Every **parent** description → matches node types in editor SelectBox.
4. Every **Output** event → has a handler in `nodes/webapp.js` or runtime.

If the doc is ahead of the implementation (speculative feature not in this phase's deliverables): leave it. Do not implement speculatively.

## Only after all three steps pass

Update `docs/agent-roadmap.yaml` status to `done`. Then commit.
