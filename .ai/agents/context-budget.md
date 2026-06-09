# Context Budget
<!-- partially generic — general rules are agent-os candidates; "Files per role" section is project-specific -->

Token cost is real. Do not read files speculatively.

## General rules

1. Read `AGENTS.md` and `docs/roadmap/INDEX.md` (slim, open work only), then **only the one package file** for your phase under `docs/roadmap/<epic>/`. Do not read other packages or the whole tree.
2. For each deliverable, identify the minimum file set: the relevant `docs/nodes/<category>/<node>.md` (categories: concepts, structure, input, display, feedback, navigation, state, behavior), the corresponding editor HTML, schema type, and runtime handler. Read those. Do not read unrelated nodes.
3. When writing tests, read one existing test file in the target package first to match conventions. Do not read all test files.
4. Do not re-read a file you already read in this session unless you need a specific line.
5. Use `grep` to locate symbols before reading whole files.

## Files per role

### New node implementation (P16x-style)
Use the `/node-red-node` skill — it contains the complete four-file pattern, code templates, checklist, and common mistakes. **Do not read existing node files to derive the pattern; the skill already has it.**

Minimum additional reads:
- `docs/nodes/<category>/<node>.md` for the node being implemented
- `packages/schema/src/node-definitions.ts` (grep for the base schema to extend)
- `nodes/webapp.js` — `grep` for `WEBAPP_NODE_TYPES` and `runtimeNodeRegistry` (the file is large and line numbers drift; do not trust a hardcoded line)

### Schema work (P11a-style)
- `packages/schema/src/node-definitions.ts`
- `packages/schema/src/contracts.ts`
- One existing test: `packages/schema/test/schema.test.ts`
- The relevant `docs/nodes/<category>/<node>.md` for each touched node

### Runtime work
- `nodes/webapp.js` (grep first — it is large)
- `packages/runtime/src/node-set.ts`
- One existing test: `packages/runtime/test/node-set-runtime.test.ts`

### Editor work (P11b-style)
- `resources/lib/editor-common.js` — the single canonical shared-editor file (Node-RED serves `resources/` statically). Do not create or read `lib/` or `nodes/lib/` copies; they must not exist.
- The specific `nodes/<category>/<node>.html` files for the phase
- One existing E2E test for editor work: `tests/e2e/editor-mount-options.spec.ts` for the structure-view sidebar, **or** the canonical per-node editor specs under `tests/e2e/nodes/editor/` (since P47) plus their helper `tests/helpers/node-editor-page.ts`.
- Editor-test gotchas (from P47): open panels via `RED.editor.edit(RED.nodes.node(id))` (not canvas double-click); Node-RED 4.x shows a first-run welcome-tour overlay that intercepts clicks (dismiss with Escape); the tray's Done button is `#node-dialog-ok` (not a footer `.primary`).

### Test-only work
- The specific test file(s) for the package
- The source file under test (grep first)

### Known pitfalls (cost repeated debug cycles — check these first)
- **Node-RED config-node trap:** a node without `x`/`y` coordinates is parsed as a *config node*, not a flow node — it silently never registers (causing `/inject/:id` 404s and "Circular config node dependency"). Every node a test deploys needs `x`/`y`.
- **`parseList` vs `parseJsonList`:** fields holding a JSON array string (columns, tabs, menu/accordion/stepper items, …) must use `parseJsonList` in `mapConfig`; `parseList` comma-splits the JSON into garbage.
- **Zod strips unknown fields silently:** if a rendered field goes missing, check the item schema actually declares it — Zod drops unknown props with no warning.
- **Serializer per-control attributes:** form-control attributes (e.g. `disabled`) must be emitted in *each* control's serializer branch; it is easy to add one to `sl-checkbox` and forget `sl-input`/`select`/`textarea`.

## What never needs reading unless explicitly relevant
- `prd.md` (read once at project start, not per phase)
- `docs/implementation-plan.md` (roadmap.yaml is the source of truth for phases)
- Unrelated node HTML files
- `packages/renderer/` (unless the phase explicitly touches rendering)
- `tests/e2e/fixtures/` (unless writing a new fixture)
