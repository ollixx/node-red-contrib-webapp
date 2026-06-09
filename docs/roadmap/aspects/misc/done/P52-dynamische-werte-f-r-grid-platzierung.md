---
id: P52
title: "Dynamische Werte für Grid-Platzierung — Evaluation + ggf. Umsetzung"
epic: aspects/misc
status: done
dependencies: [P51]
---
# P52 — Dynamische Werte für Grid-Platzierung — Evaluation + ggf. Umsetzung

## Result

**Delivered:** ADR 0004 (dynamic grid placement) committed, deciding option A (runtime update via msg.ui.patch) over option B (typedInput bindings, deferred). Implemented A: P51's positive-integer rule now enforced on the runtime patch path (invalid row/col/colSize/rowSize dropped with a clear node error per ADR 0006; layoutX/layoutY exempt), and live placement patches are carried into the pushed SSE snapshot so elements actually reflow.

**Stats:** 5 files (1 ADR, nodes/webapp.js, 1 runtime unit test +6 tests, 1 E2E spec, 1 E2E fixture), +6 unit tests (235 total), +1 E2E spec. No schema/editor/binding change.

**Notes:** Decision-first phase. B's binding kinds already exist in bindingSchema, but making placement a binding forces binding-source context into the synchronous HTML serializer that lacks it — high cost, marginal value over A; deferred with follow-up trigger in the ADR. A was ~90% pre-wired via P39's msg.ui.patch; the two real gaps fixed were (1) no positive-integer validation on the patch path and (2) readDeployDefinitions dropping live layout patches from the rebuilt snapshot. Full E2E suite OOM-killed by host memory pressure during validation (not code failures); pnpm validate (lint + 389 unit + build + roadmap) fully green.

**Cost:** session 1656913a-1e20-493e-a501-1b549d3b325a, 33m
