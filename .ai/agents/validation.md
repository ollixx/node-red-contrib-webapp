# Self-Validation Protocol
<!-- generic — candidate for agent-os repo -->

No human reviews PRs. The agent is responsible for verifying its own work before marking a phase done. Complete all three steps — in order — before updating the phase status to `done`.

## Step 1: Tests must be green

Run the full test suite and all E2E tests. Fix every failure before proceeding. No exceptions.

```
pnpm test
pnpm exec playwright test
```

**Never pipe the authoritative E2E run through `tail`/`head` — it lies.**
A pipeline's exit code is the *last* command's, so `pnpm exec playwright test | tail` always
exits `0` even when tests fail; and Playwright prints its `N failed` header *above* the trailing
failed-test list, so `tail -N` scrolls the failure count off the top and leaves only `… passed`
visible. Both together produce a convincing false-green. This has caused phases to be closed
`done` with real regressions on the integration branch. Instead capture the full output and assert
explicitly:

```
pnpm exec playwright test > /tmp/e2e.log 2>&1; echo "exit=$?"
grep -cE '[0-9]+ failed' /tmp/e2e.log   # must be 0
```

The only acceptable signal is **`exit=0` AND zero `failed` lines** — never a `passed` count read
from a piped tail. A quick cross-check when a phase adds N tests: the suite total must rise by ~N;
if it stayed flat, the new tests (or others) silently failed.

**Anti-baseline rule — no exceptions, no rationalisation.**
It does not matter whether a failing test was already failing before your phase started.
If `pnpm exec playwright test` exits with any failure, you must fix every failing test before
marking the phase done — even tests unrelated to this phase's deliverables. "Pre-existing",
"unrelated", "net improvement", and "baseline" are not valid reasons to leave a test red.
If a test is genuinely obsolete (tests a removed feature), delete it. If it tests something
real, fix it. The only acceptable exit state is zero failures.

## Step 2: Write and verify tests for every validation criterion

Open the phase's package file under `docs/roadmap/<epic>/` and use its **`acceptance`** list (and `verify:` mode) as the validation criteria. For each criterion, **write the test first if it does not exist**, then verify it passes. For `verify: browser`, the criterion must additionally be proven in the running app (preview/Playwright), not just by a unit test:

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

Append the `## Result` section to the package file, flip its frontmatter `status: done`, update `docs/roadmap/INDEX.md` (remove from "Open work", bump the epic's done rollup), and run `pnpm check:roadmap`. Then commit. (Orchestrated: report the result back; the orchestrator does these roadmap writes.)
