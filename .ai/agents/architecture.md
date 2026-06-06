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
| `resources/lib/editor-common.js` | Shared editor utilities (SelectBox, reference selectors, layout helpers) — **single canonical copy** |

**Editor asset serving — do not duplicate.** Node-RED serves the `resources/` directory of a plugin statically. The editor utilities therefore live in exactly one file: `resources/lib/editor-common.js`. Do **not** create `lib/editor-common.js` or `nodes/lib/editor-common.js` — earlier copies in those paths were dead duplicates that drifted out of sync and caused silent stale-code bugs. The node HTML files load it via `resources/node-red-contrib-webapp/lib/editor-common.js`.

## Key invariants

- `packages/schema` has no dependencies on other packages in this repo.
- `nodes/webapp.js` is the Node-RED runtime entry point — it maps node configs to schema definitions and handles all message routing.
- Layout presets are the only layout mechanism. There are no custom `ui-layout` or `ui-slot` nodes.
- App scoping: every non-app node belongs to exactly one `ui-app` via its `parent` field.
- Mount paths follow the pattern `<type>:<id>/<slot>` (e.g. `route:/customers/content`).
- A `ui-route` path must never be `"/"`. The `ui-app` node is the implicit root route; home content mounts to `appId.*` slots (e.g. `appId.content`). The schema (`routeNodePathSchema` in `packages/schema/src/contracts.ts`) and the editor reject a `ui-route` with `path: "/"`. The compiled `AppModel` still contains a single `"/"` route — the implicit app root with `id === appId`, created by `createAppRootRoute`.
- The example flow (`examples/customers-crud/flow.json`) is **generated**, not hand-edited. It is produced from the typed schema fixture via `pnpm gen:example` (see P18). After any phase that renames or adds node fields, re-run `pnpm gen:example` as the final step so the example stays current without manual migration.
- **`.node-red-dev/flows.json` is completely off-limits for agents.** Never read, write, or regenerate it — not even via `pnpm gen:example`. It is the owner's personal dev environment and only the owner manages it.

## Stop conditions

Stop and write down the decision needed if:

1. A phase requires changing how mount paths are parsed or structured.
2. A phase requires adding a new package to the workspace.
3. A phase requires a new Node-RED node type not in the current catalog.
4. Validation fails twice for the same phase without a clear fix.
5. A spec doc contradicts the implementation in a way that cannot be resolved without a product decision.
