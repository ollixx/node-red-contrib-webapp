# ADR 0001: Initial workspace and architecture defaults

- Status: accepted
- Date: 2026-03-26

## Context

The project starts in a plan-first state. Phase P0 must remove the open architecture ambiguity before functional implementation begins. The PRD and implementation plan require explicit decisions for renderer choice, shared schema validation, and package boundaries, while preserving a clear separation between structure, runtime event flow, and editor UX.

## Decision

### Renderer choice

Use React in the renderer package and adopt React Router for route composition.

Reasoning:

- The product needs route-centric composition, layouts, dialogs, forms, and state-bound components.
- React Router matches the route and nested layout model described in the PRD without requiring UI hierarchy to be inferred from Node-RED wiring.
- The renderer can stay isolated in its own package without leaking framework concerns into runtime or editor modules.

### Schema validation strategy

Use Zod as the end-to-end schema validation layer in the shared schema package.

Reasoning:

- Runtime, editor, and renderer all need the same contracts and predictable validation failures.
- Zod allows the project to keep TypeScript-first contracts in one place while producing readable validation errors for later phases.
- The dedicated schema package becomes the single source of truth for UI definitions and event payloads.

### Package boundaries

Use a pnpm workspace with strict package boundaries and these package responsibilities:

- @node-red-contrib-webapp/schema: shared contracts, validators, fixtures, and mount parsing.
- @node-red-contrib-webapp/runtime: Node-RED runtime integration, registry assembly, and HTTP APIs.
- @node-red-contrib-webapp/renderer: browser rendering, routing, slot mounting, and UI event bridge.
- @node-red-contrib-webapp/editor: editor nodes, validation helpers, and the structure sidebar.

Boundary rules:

- The schema package is the only place that defines shared UI contracts.
- Runtime, renderer, and editor may depend on schema.
- Runtime and editor must not depend on renderer.
- Editor UX structure must be derived from the compiled registry model, not from wire topology.

### Additional architecture defaults locked in P0

- Runtime model assembly will use a central registry service that compiles node registrations into a normalized app model.
- The editor structure view will render from the compiled registry instead of reconstructing parent-child hierarchy from wiring.

## Consequences

- The scaffold can be created as a TypeScript monorepo without implementing Phase P1 contracts yet.
- Later phases should add Zod to the schema package and React tooling to the renderer package instead of revisiting those choices.
- Any change to renderer framework, schema strategy, or package boundary rules after P0 requires a new ADR and should be treated as a stop condition.
