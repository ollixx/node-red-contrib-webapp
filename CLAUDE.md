# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
corepack pnpm install

# Build all packages (TypeScript compilation)
pnpm build

# Run all unit tests across all packages
pnpm test

# Run a single package's tests
pnpm --filter @node-red-contrib-webapp/schema test
pnpm --filter @node-red-contrib-webapp/runtime test

# Run a specific test file
pnpm vitest run packages/schema/test/schema.test.ts

# Lint all packages
pnpm lint

# Build + lint + test in one step (required before marking a phase done)
# (also runs the two read-only tripwires below)
pnpm validate

# Roadmap tripwire: package frontmatter, deps, INDEX sync, roadmap link hygiene
pnpm check:roadmap

# Doc-link tripwire: every markdown link in docs/ + .ai/ AND every docs/*.md
# path referenced from source code must resolve
pnpm check:links

# Run E2E tests (requires Playwright and auto-starts Node-RED on port 1882)
pnpm exec playwright test

# Run a specific E2E spec
pnpm exec playwright test tests/e2e/customers-crud.spec.ts

# Start the dev Node-RED instance on port 1881
pnpm dev:start

# Smoke-test the customers-crud example (schema + runtime + renderer)
pnpm example:customers-crud

# Generate per-node example flows for Node-RED import (examples/<category>/<node>.json)
pnpm gen:node-examples
```

## Architecture

This is a pnpm workspace of TypeScript packages that add declarative UI nodes to Node-RED. The goal is to let flows describe a web-app's structure declaratively rather than imperatively wiring components together.

### Package boundaries

| Package | Role |
|---|---|
| `packages/schema` | Shared Zod validators, type contracts, layout presets, mount-path parsing, and fixtures. **No repo-internal dependencies.** |
| `packages/runtime` | Accepts raw node configs, assembles them into a `Registry`, compiles the registry to a validated `AppModel`, and exposes it via the Runtime API. |
| `packages/renderer` | Takes a compiled `AppModel` and produces route/slot/event snapshots. Resolves state bindings, query bindings, and route params. Emits `msg.ui`-format events. |
| `packages/editor` | Validates node configurations before deploy. Builds a structural sidebar view from the compiled registry — not from canvas wires. |
| `nodes/` | Node-RED node registrations (one `.js` + `.html` pair per node). At runtime these map node configs to schema definitions and handle message routing. |
| `nodes/webapp.js` | The single Node-RED runtime entry point. All node types are registered here (see the `node-red.nodes` block in `package.json` for the current set); it holds the `runtimeState` map and registers HTTP endpoints. |
| `resources/lib/editor-common.js` | Shared editor UI helpers: SelectBox, reference selectors, layout helpers used by all node HTML files. **Single canonical copy** — Node-RED serves `resources/` statically; node HTML loads it via `resources/node-red-contrib-webapp/lib/editor-common.js`. Do not recreate `lib/` or `nodes/lib/` copies. |

### Data flow

1. A Node-RED flow contains `ui-app`, `ui-route`, `ui-container`, `ui-input`, etc. nodes.
2. `nodes/webapp.js` reads each node's config and maps it to a schema-validated definition.
3. `packages/runtime` assembles those definitions into registry contributions and compiles them into a normalised `AppModel`.
4. `packages/renderer` renders the model into route and dialog snapshots and resolves bindings.
5. `packages/editor` can consume the same model to build the structure sidebar without inferring hierarchy from wires.

### Key invariants

- UI hierarchy is expressed via `parent` and `mount` fields on each node — never via wires. Wires carry data/event flow only.
- Mount paths follow the pattern `<type>:<id>/<slot>` (e.g. `route:/customers/content`).
- Every non-app node must declare either a `mount` or a `parent` field.
- Layout is always a preset — there are no custom `ui-layout` or `ui-slot` nodes.
- `packages/schema` must never import from other packages in this repo.
- `examples/customers-crud/flow.json` is generated, not hand-edited. After any phase that renames or adds node fields, regenerate it with `pnpm gen:example` (available from P18 onward).

### Node categories

Nodes are grouped under `nodes/` by **four** runtime categories:

- `structure/` — `ui-app`, `ui-route`, `ui-dialog`
- `view/` — all display & input components (`ui-text`, `ui-button`, `ui-table`, `ui-input`, `ui-select`, `ui-badge`, …)
- `state/` — `ui-store`, `ui-query`
- `behavior/` — `ui-action`, `ui-navigation`

**Note:** the spec docs under `docs/nodes/` use a *finer* taxonomy — `concepts`, `structure`, `input`, `display`, `feedback`, `navigation`, `state`, `behavior` (there is **no** `docs/nodes/view/`). A `view/` node's spec lives under `input`/`display`/`feedback`/`navigation` by its role. The authoritative list is in `.ai/agents/context-budget.md`.

### Dev and E2E environments

- `.node-red-dev/` — persistent dev Node-RED user directory (port 1881). Used for manual testing. **`.node-red-dev/flows.json` is the owner's personal dev environment and is completely off-limits for agents** — never read, write, or regenerate it (not even via `pnpm gen:example`). Only the owner manages this file.
- `.node-red-e2e/` — ephemeral E2E user directory (port 1882). Rebuilt from scratch before every Playwright run using `examples/customers-crud/flow.json`.

## Agent workflow

This repo uses a phased roadmap. Before any implementation work, read:

1. `AGENTS.md` — entry point, roles, non-negotiable rules
2. `docs/roadmap/INDEX.md` — current phase (first `pending` package under "Open work" whose deps are done); then the package file under `docs/roadmap/<epic>/`
3. `.ai/agents/architecture.md` — stop conditions and package invariants
4. `.ai/agents/validation.md` — three-step self-validation protocol (tests → validation criteria → spec cross-check)
5. `.ai/agents/context-budget.md` — minimum file set per role; do not read speculatively

Per-node spec files live in `docs/nodes/<category>/<node>.md`. The roadmap, not `prd.md` or `docs/implementation-plan.md`, is the source of truth for what to implement.

**`.node-red-dev/flows.json` is completely off-limits for agents** — never touch it. `examples/customers-crud/flow.json` is generated (not hand-edited) and must only be changed via `pnpm gen:example` — no positional normalisation, no re-ordering, no touching other flows in the same file.
