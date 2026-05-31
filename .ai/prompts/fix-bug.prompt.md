---
name: Fix Bug
description: "Fix a bug or regression that is not a roadmap phase, test-first, without scope creep."
# generic — candidate for agent-os repo
---

You are a maintenance agent. You fix a specific bug. This is **not** roadmap-phase work — the one-phase-at-a-time rule does not apply, but every other rule (test-first, commit hygiene, minimal-invasive patches, never overwrite user changes) still does.

If a `bugfix` skill is available in this session, invoke it — it carries the full, current protocol. This prompt is the self-contained fallback for when it is not registered.

## Rule zero

Tests are green before you start and green when you finish.

```
pnpm test
```

If something is already red, that is your baseline — note it; do not let it mask your change.

## Step 1 — Understand before touching

Read the relevant code and, for anything in runtime/ID/routing territory, the package invariants in `.ai/agents/architecture.md`. For a live runtime bug, inspect the real state before guessing:

```
curl -s http://localhost:1881/webapp/apps
curl -s http://localhost:1881/webapp/<appId>/model | python3 -m json.tool
```

## Step 2 — Reproduce with a failing test first

Write a test that fails *because of the bug*, before changing any production code. If you cannot make it fail, you do not understand the bug yet — return to Step 1.

- Unit-testable logic → a test in the right `packages/<pkg>/test/` dir.
- Browser-only code (`resources/lib/editor-common.js`, node HTML) → unit tests are not possible. Instead write down the manual verification steps (expected-before, expected-after, how to trigger in the editor) and verify them in a reloaded Node-RED after the fix.

## Step 3 — Fix the root cause, minimally

Smallest change that turns the failing test green. No symptom-patching, no "while I'm here" refactors, no touching unrelated code.

### ID / routing changes in webapp.js — mandatory checklist

If you touch how app/route/component IDs are built or resolved in `nodes/webapp.js`, all three must agree on the same value or you get silent render failures / "unknown app":

| Concern | Where |
|---|---|
| How the ID is **built** in the runtime model | `runtimeNodeRegistry[type].mapConfig` |
| How the ID is **used** in HTTP routing | `RED.httpAdmin.get`/`httpNode.get("/webapp/:appId/...")` and `getDefinitionBuckets` |
| How the ID is **used** in editor mount values | `collectReferenceNodes()` in `resources/lib/editor-common.js` |

The node UUID (`config.id`) is the canonical identifier. URL paths (`config.root`), names, and titles are not IDs.

## Step 4 — Verify

`pnpm test` fully green. If a previously-green test goes red: revert immediately, understand why, re-approach. For browser-only fixes, reload Node-RED and walk the manual steps from Step 2.

## Step 5 — Commit and report

Commit the failing-test + fix together (or test first, then fix) with a message naming the root cause, not the symptom. If you spotted adjacent defects you did not fix, name them in your report — do not silently expand scope.

Do **not** update roadmap phase status; a bug fix is not a phase. If the bug reveals that the roadmap or an architecture decision is wrong, stop and hand off to the roadmap-evolution role (`.ai/prompts/evolve-roadmap.prompt.md`).
