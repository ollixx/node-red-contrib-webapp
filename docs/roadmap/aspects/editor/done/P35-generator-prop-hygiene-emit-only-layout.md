---
id: P35
title: "Generator prop hygiene — emit only layout-appropriate props, clean editor validation"
epic: aspects/editor
status: done
dependencies: [P34]
---
# P35 — Generator prop hygiene — emit only layout-appropriate props, clean editor validation

## Result

**Delivered:** Made scripts/gen-example.js layout-aware: each node now receives only the placement props valid for its parent layout. Grid-layout nodes get row/col/colSize/rowSize; absolute-layout nodes get layoutX/layoutY; vertical/horizontal/app-layout nodes get none. Implemented via a getPlacementProps() helper that filters placement data based on the mount target's layout type. Regenerated examples/customers-crud/flow.json and .node-red-dev/flows.json — all vertical/app-layout nodes now have zero stray placement props.

**Stats:** 1 file modified (scripts/gen-example.js with helper + mount-to-layout mapping), 2 files regenerated (.json flows), 1 unit test file (scripts/gen-example.test.js with 10 test cases), 1 E2E test file (p35-gen-hygiene.spec.ts with structural validation). Unit suite: 178 tests, 0 failures. E2E: 48 tests, 0 failures (added 1 new test to the suite). pnpm validate green.

**Notes:** Editor validation stance: rather than having the editor ignore stray props (permissive), P35 follows the 'fix at source' approach — the generator never emits layout-inappropriate props in the first place, so the editor validation has nothing to ignore. No changes to packages/editor were needed. The helper is small (50 lines) and localized to the generator, making it easy to maintain and understand.
