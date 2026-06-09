---
id: P62
title: "Bugfix — Shoelace Token-Bridge: Self-Reference-Cycle entfernen (fehlendes sl-button-Padding)"
epic: aspects/misc
status: done
dependencies: [P57]
---
# P62 — Bugfix — Shoelace Token-Bridge: Self-Reference-Cycle entfernen (fehlendes sl-button-Padding)

## Result

**Delivered:** Fixed the CSS self-reference cycle in buildShoelaceTokenBridgeCss() (packages/renderer/src/shoelace-adapter.ts): the bridge now emits `--sl-X: var(--wa-Y, <literal Shoelace 2.20.1 light-theme default>)` instead of `--sl-X: var(--wa-Y, var(--sl-X))`. The old self-referencing fallback created a CSS dependency cycle whenever --wa-Y was unset → the property became guaranteed-invalid (Shoelace default NOT restored), collapsing sl-button label padding to 0. Also removed the semantically wrong --sl-spacing-medium ← --wa-spacing-unit mapping (base unit 0.25rem vs absolute medium 1rem) so Shoelace keeps its own spacing scale. Doc comment aligned with actual behavior.

**Stats:** shoelace-adapter.ts + shoelace-adapter.test.ts (+2 regression tests); nodes/webapp.js touched (head :root decision). renderer tests + E2E 258 passed / 0 failed; pnpm validate green.

**Notes:** Verification basis (honest): the primary guard is a UNIT regression test that asserts (1) NO token's fallback contains its own `var(--sl-…)` (no self-reference cycle can be re-introduced) and (2) --sl-spacing-medium is no longer bridged — both fail before the fix, pass after (test-driven). The full Shoelace E2E layer (P23 served-HTML + P26 render-parity) stays green, exercising real sl-* rendering in a browser. A dedicated computed-style E2E asserting sl-button horizontal padding > 0 was NOT separately added (Playwright cannot bootstrap in the worktree; the orchestrator ran the full suite in the main checkout, 258 green). The cycle is structurally impossible now because no fallback self-references, so each --sl-* falls back to its literal Shoelace default when the corresponding --wa-* is unset.


**Cost:** session <see .ai/agent-runs.jsonl>, 2026-06-06T23:39:39Z → 23:48:05Z (~8m); orchestrator main-checkout E2E + validate; subagent_tokens ~75k
