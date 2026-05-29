# Implementation Plan

## Outcome

Build a Node-RED contribution that lets users model web apps declaratively instead of encoding UI hierarchy in flow wiring. The first release should prove the model with a CRUD example that uses routes, layouts, slots, state, events, dialogs, containers, and inputs.

## Recommended Technical Shape

Use a TypeScript workspace with four main modules:

1. `packages/schema`
   Shared UI definition types, validators, mount-path parser, and event contracts.
2. `packages/runtime`
   Node-RED runtime integration, registry assembly, HTTP APIs, and state/event plumbing.
3. `packages/renderer`
   Browser renderer for routes, layouts, slots, containers, dialogs, and state-bound view components.
4. `packages/editor`
   Node-RED editor node definitions, property panels, validation helpers, and the structure sidebar.

Add `examples/customers-crud` as the reference flow once the MVP skeleton exists.

## Architectural Decisions To Lock First

Phase 0 should confirm these decisions explicitly:

1. Renderer stack
   Recommendation: React plus React Router for fast route/layout composition.
2. Shared schema validation
   Recommendation: Zod or JSON Schema generation from TypeScript types. Pick one and use it end to end.
3. Package topology
   Recommendation: pnpm workspace with strict package boundaries from day one.
4. Runtime model assembly
   Recommendation: central registry service that compiles node registrations into a normalized app model.
5. Editor structure view
   Recommendation: build a sidebar tree from the compiled registry instead of reconstructing hierarchy from wires.

## Delivery Phases

### Phase 0: ADRs and Scaffold

Purpose: remove the open architecture ambiguity before implementation starts.

Deliverables:

- workspace scaffold
- ADR for renderer and schema strategy
- baseline lint, test, and build commands
- package boundaries and naming conventions

Definition of done:

- one command installs dependencies
- one command validates all packages
- architecture decisions are documented, not implied

### Phase 1: Shared UI Model

Purpose: define the contracts every other part depends on.

Deliverables:

- component definition schema
- mount syntax parser and validator
- route, layout, slot, binding, and event contract types
- sample app model fixtures

Definition of done:

- invalid definitions fail validation predictably
- fixtures cover route, dialog, and slot mounting

### Phase 2: Runtime Registry Core

Purpose: build the central registry that replaces parent-child propagation.

Deliverables:

- node registration lifecycle
- model compilation from registrations
- runtime API to fetch compiled app model
- conflict detection for duplicate IDs and invalid mounts

Definition of done:

- the runtime can emit a stable compiled model from fixtures or node registrations
- duplicate component IDs and bad mount targets are surfaced clearly

### Phase 3: Renderer MVP

Purpose: prove that the compiled model can render a real app shell.

Deliverables:

- route and layout rendering
- slot-based mounting
- view rendering for text, button, table, container, input, and dialog
- client state bindings and event dispatch bridge

Definition of done:

- a minimal multi-page app renders from the compiled model
- button clicks and input-driven submits emit the standard `msg.ui` event shape

### Phase 4: Node-RED Node Set MVP

Purpose: expose the declarative model as usable nodes.

Deliverables:

- `ui-app`
- `ui-route`
- `ui-text`
- `ui-button`
- `ui-table`
- `ui-container`
- `ui-input`
- `ui-dialog`
- `ui-store`
- `ui-query`
- `ui-action`
- `ui-navigation`

Definition of done:

- each node emits or registers a schema-valid definition
- node edit dialogs validate required fields before deploy

### Phase 5: State, Query, and Event Integration

Purpose: connect UI interactions to Node-RED flow logic cleanly.

Deliverables:

- store updates and derived values
- query loading states and refresh triggers
- navigation events
- dialog open and close actions
- visibility and enabled rules

Definition of done:

- a full CRUD loop works in the example app
- event payloads stay consistent across all interactive nodes

### Phase 6: Editor Structure View

Purpose: make complex UIs understandable inside the Node-RED editor.

Deliverables:

- sidebar tree for app, routes, preset slots, child layouts, and mounted components
- selection sync between canvas and structure view
- validation warnings for orphaned mounts and unresolved slots

Definition of done:

- a user can inspect UI structure without following flow wires to infer hierarchy

### Phase 7: Example App, Docs, and Hardening

Purpose: package the MVP into something evaluable by users.

Deliverables:

- customer CRUD example flow
- setup guide
- architecture overview
- test coverage for core schema and registry logic
- smoke validation for runtime and renderer

Definition of done:

- a new contributor can run the example locally from documented steps
- the example demonstrates routes, table, dialog, container/input composition, navigation, and state updates

## Suggested Execution Order On GitHub

Use one issue per phase. Each issue should contain:

1. phase ID and title
2. scope boundaries
3. deliverables copied from the roadmap
4. validation commands
5. explicit dependencies on earlier phase issues

Run agent work in this order:

1. orchestrator picks the next ready phase
2. implementer executes only that phase
3. reviewer checks the result against the phase definition of done
4. orchestrator marks the phase complete and moves to the next one

## Stop Conditions

The agent pipeline should stop and request human input if one of these happens:

1. renderer framework choice changes after Phase 0
2. shared schema strategy changes after Phase 1
3. runtime registry model needs a breaking redesign
4. editor UX requires behavior not supported by the chosen framework split
5. the example app reveals missing MVP node types

## First Practical Milestone

The fastest credible milestone is not the full node set. It is this slice:

1. scaffold workspace
2. define shared schema
3. compile registry from fixtures
4. render one route with one layout and mounted components
5. prove button event dispatch and one dialog flow

That slice de-risks the core product assumption before the editor sidebar and full node catalog are built.