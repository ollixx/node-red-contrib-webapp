# Architecture Defaults
<!-- project-specific — belongs in this repo, not in agent-os -->

## Package structure

| Package | Responsibility |
|---|---|
| `packages/schema` | Shared types, Zod validators, mount parser, layout presets |
| `packages/runtime` | Node-RED registry, model compiler, runtime API |
| `packages/renderer` | Browser renderer, state bindings, event dispatch |
| `packages/editor` | Editor node definitions, structure sidebar, validation helpers |
| `nodes/` | Node-RED node registrations (HTML + JS per node) |
| `lib/editor-common.js` | Shared editor utilities (SelectBox, reference selectors, layout helpers) |

## Key invariants

- `packages/schema` has no dependencies on other packages in this repo.
- `nodes/webapp.js` is the Node-RED runtime entry point — it maps node configs to schema definitions and handles all message routing.
- Layout presets are the only layout mechanism. There are no custom `ui-layout` or `ui-slot` nodes.
- App scoping: every non-app node belongs to exactly one `ui-app` via its `parent` field.
- Mount paths follow the pattern `<type>:<id>/<slot>` (e.g. `route:/customers/content`).

## Stop conditions

Stop and write down the decision needed if:

1. A phase requires changing how mount paths are parsed or structured.
2. A phase requires adding a new package to the workspace.
3. A phase requires a new Node-RED node type not in the current catalog.
4. Validation fails twice for the same phase without a clear fix.
5. A spec doc contradicts the implementation in a way that cannot be resolved without a product decision.
