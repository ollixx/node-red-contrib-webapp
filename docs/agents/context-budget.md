# Context Budget

Token cost is real. Do not read files speculatively.

## General rules

1. Read `AGENTS.md` and the **current phase entry only** from `docs/agent-roadmap.yaml` — not the whole file.
2. For each deliverable, identify the minimum file set: the relevant `docs/nodes/<node>.md`, the corresponding editor HTML, schema type, and runtime handler. Read those. Do not read unrelated nodes.
3. When writing tests, read one existing test file in the target package first to match conventions. Do not read all test files.
4. Do not re-read a file you already read in this session unless you need a specific line.
5. Use `grep` to locate symbols before reading whole files.

## Files per role

### Schema work (P11a-style)
- `packages/schema/src/node-definitions.ts`
- `packages/schema/src/contracts.ts`
- One existing test: `packages/schema/test/schema.test.ts`
- The relevant `docs/nodes/<node>.md` for each touched node

### Runtime work
- `nodes/webapp.js` (grep first — it is large)
- `packages/runtime/src/node-set.ts`
- One existing test: `packages/runtime/test/node-set-runtime.test.ts`

### Editor work (P11b-style)
- `lib/editor-common.js`
- The specific `nodes/<category>/<node>.html` files for the phase
- One existing E2E test: `tests/e2e/editor-mount-options.spec.ts`

### Test-only work
- The specific test file(s) for the package
- The source file under test (grep first)

## What never needs reading unless explicitly relevant
- `prd.md` (read once at project start, not per phase)
- `docs/implementation-plan.md` (roadmap.yaml is the source of truth for phases)
- Unrelated node HTML files
- `packages/renderer/` (unless the phase explicitly touches rendering)
- `tests/e2e/fixtures/` (unless writing a new fixture)
