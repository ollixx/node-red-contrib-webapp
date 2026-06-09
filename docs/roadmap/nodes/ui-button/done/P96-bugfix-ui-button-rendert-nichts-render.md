---
id: P96
title: "🔴 Bugfix: ui-button rendert NICHTS — Render-Pipeline-Ursache finden und fixen + Outcome-Test (sl-button mit Label im DOM)"
epic: nodes/ui-button
status: done
dependencies: [P26]
node: ui-button
spec: docs/nodes/display/ui-button.md
tests: tests/e2e/nodes/view/ui-button.tests.md
---
# P96 — 🔴 Bugfix: ui-button rendert NICHTS — Render-Pipeline-Ursache finden und fixen + Outcome-Test (sl-button mit Label im DOM)

## Result

**Delivered:** Verified ui-button render pipeline was already correct (no bug — pre-fixed by P83/P71); added 25 outcome-based unit tests (serializer path: label-in-slot, XSS guard, variant/size/outline/disabled/linkMode/icon) + 12 fresh E2E tests replacing P43/P44 presence-only specs; per-node test catalogue .md added.

**Stats:** 4 files added (+1765 lines); 25 unit tests (all pass); 12 E2E tests written; 686 runtime unit tests green.

**Notes:** Bug was pre-fixed by earlier phases. Deliverable reframed as fresh outcome-based test suite that locks pipeline correctness.

**Cost:** session a1b9d5c6-8aba-419a-92c5-2a9a194639c4, 19m
