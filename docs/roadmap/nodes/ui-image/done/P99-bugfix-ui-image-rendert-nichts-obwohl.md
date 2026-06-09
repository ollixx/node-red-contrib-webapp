---
id: P99
title: "🔴 Bugfix: ui-image rendert NICHTS — obwohl P70 das Rendering aktivieren sollte. Render-Pipeline-Ursache finden (components-Filter/KIND_MAP/renderer/serializer) und fixen + Outcome-Test (<img> mit src im DOM)"
epic: nodes/ui-image
status: done
dependencies: [P70]
node: ui-image
spec: docs/nodes/display/ui-image.md
tests: tests/e2e/nodes/view/ui-image.tests.md
---
# P99 — 🔴 Bugfix: ui-image rendert NICHTS — obwohl P70 das Rendering aktivieren sollte. Render-Pipeline-Ursache finden (components-Filter/KIND_MAP/renderer/serializer) und fixen + Outcome-Test (<img> mit src im DOM)

## Result

**Delivered:** Verified ui-image render pipeline was already correct (fixed by P70); added 21 outcome-based unit tests (p99-image-render-pipeline.test.ts: serializer → <img> with src/alt/fit/width/height/fallbackSrc/onerror/asset-proxy, plus full renderAppPage integration) and 10 fresh E2E tests (ui-image.spec.ts: browser DOM render, server HTML, alt, dimensions, fallback onerror, msg.payload src update, asset proxy, path-traversal guard); deleted old P70 render tests per node-testing.md fresh-tests rule; added per-node test catalogue .md.

**Stats:** 5 files changed (529 insertions, 122 deletions); 21 new unit tests, 10 new E2E tests; 781 unit tests pass total; pnpm validate green.

**Notes:** No code bug found — the 'renders NOTHING' claim was already fixed in P70 (same finding as P96 for ui-button). P99 deliverable is fresh outcome-based tests that lock the correctness in. Old p70-image-render.test.ts (4 tests) discarded per node-testing.md.

**Cost:** session claude-sonnet-4-6, 19m
