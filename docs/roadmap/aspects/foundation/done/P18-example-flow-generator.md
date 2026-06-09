---
id: P18
title: "Example flow generator"
epic: aspects/foundation
status: done
dependencies: [P11b]
---
# P18 — Example flow generator

## Result

**Delivered:** Generator script scripts/gen-example.js converts customersCrudNodeSetFixture into examples/customers-crud/flow.json; pnpm gen:example script added; 4 unit tests assert generated flow validates against schema.

**Stats:** 1 generator script, 1 package.json script, 4 new tests in schema.test.ts, AGENTS.md updated

**Notes:** Generator uses CJS require() to import from built schema dist — no tsx needed. customersCrudExampleFlowFixture in fixtures.ts updated to include z field and consistent ROW_STEP=60. Architecture.md already had the gen:example note (added by P18 spec); AGENTS.md rule 5 updated to make flow files generated-only.
