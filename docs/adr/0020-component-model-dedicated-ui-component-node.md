# ADR 0020: Component model — a dedicated `ui-component` definition/instance node

- Status: accepted
- Date: 2026-06-14
- Adopts: [ADR 0019](0019-component-substrate-subflow-vs-ui-component.md) recommendation **B**
  (a dedicated `ui-component` node, **not** a Node-RED subflow) — ADR 0019 was the
  feasibility-spike output (P166) and explicitly framed itself as *input to this
  follow-up decision ADR*.
- Builds on: [ADR 0017](0017-ui-repeat-template-container-render-time-scope.md)
  (render-time scope, template clone + re-id, keyed identity — the machinery this
  reuses), [ADR 0001](0001-initial-architecture.md) (mount-not-wires; static
  registry→AppModel→snapshot pipeline), [ADR 0014](0014-mount-picker-two-column-tree.md)
  (mount tree).
- Resolves: the deferred Components concept **P141**.

> This ADR is a **decision + contract**, not code. It commits to substrate **B**
> and specifies the v1 `ui-component` contract concretely enough to derive
> implementation phases. It changes no code; `pnpm validate` stays green.

## Context

A **Component** (P141) is a named, parametrised, reusable **set of `ui-*` nodes** —
authored once as a **definition**, used many times as an **instance** with props.
The owner direction (2026-06-12) was: check a Node-RED subflow as the substrate
**first** (node-red-first); fall back to a dedicated node only if the subflow can't
cleanly carry an inner mount-subtree + typed props + a single outer mount point.

The P166 feasibility spike ([ADR 0019](0019-component-substrate-subflow-vs-ui-component.md))
traced the live pipeline and concluded the subflow **fails all three feasibility
tests** — not on effort but on architectural mismatch: this package reads the flow
file **statically** and reconstructs hierarchy from **mount strings**, bypassing
Node-RED's wire-time runtime, which is exactly where subflow instantiation,
env-prop delivery, and id namespacing live. A subflow's inner nodes carry the
wrong `.z`, its instance node is filtered out by type, and its env-props live on
the wire path that mount-not-wires forbids. Conversely a dedicated node is **small
and well-precedented** — largely a *third application* of the ADR 0017
scope+clone+re-id machinery (after `ui-repeat` itself), which is now shipped and
proven in production.

## Decision

Build Components as a **dedicated `ui-component` node pair** — a **definition** and
an **instance** — reusing the ADR 0017 render-time-scope machinery. Two contract
additions, both small local extensions of existing enums/grammar with shipped
precedent:

1. **One new mount scope `def:`.** `parseMountReference` (`packages/schema/src/validation.ts`)
   learns `def:<componentId>/<slot>` as a sibling of `route:`/`dialog:`/`layout:`/
   `container:`. A component **definition's** children mount into `def:<componentId>/content`.
2. **One new scope-local binding kind `prop`.** `prop` (and dotted `prop.<name>`)
   is added to `SCOPE_LOCAL_BINDING_KINDS` (`packages/schema/src/contracts.ts`),
   the exact sibling of `item`/`index` (ADR 0017). It resolves at render time
   against a `propScope` frame; outside any component instance it resolves to
   `undefined` (an editor-validateable misuse), mirroring `item` today.

### The two roles

- **`ui-component-definition`** — a container-kind node. Its children mount into
  `def:<id>/content`. It is **off-canvas**: mounted into nothing real, so it
  **never renders on its own**; it exists only to be expanded by instances.
- **`ui-component-instance`** — a leaf-shaped node that carries an **outer `mount`**
  into a real route/container, a **`definitionId`** referencing a definition, and a
  **`props`** map (named values, each an ordinary typedInput → any binding kind).

### Expansion = `expandComponent` (modelled 1:1 on `expandRepeat`)

At render time, for each `ui-component-instance`:
1. resolve the instance's `props` typedInputs (every binding kind) → build one
   `propScope` frame `{ <name>: value, … }`;
2. push the `propScope` frame (next to `itemScope`);
3. render the `def:<definitionId>/content` subtree against the extended scope —
   children's `prop.<name>` bindings resolve against the top frame;
4. **re-id** each rendered node `<instanceId>#<innerNodeId>` (the
   `expandRepeat` `<itemKey>#<childId>` recipe), keeping clones unique and stable
   for the keyed morph;
5. **flatten** the rendered subtree into the instance's host region (the instance's
   outer `mount` is the bridge between "inside" and "outside", exactly like the
   `ui-repeat` template mount).
Nested/recursive components recurse like nested repeats, with an **explicit
self-reference guard** (a definition may not instantiate itself, directly or
transitively → editor/deploy error, no infinite expansion).

### Runtime bucketing

`getDefinitionBuckets` (`nodes/webapp.js`) and `WEBAPP_NODE_TYPES` learn the two new
node types. The **definition's children live on the normal canvas** and bucket into
the app by their real-flow `.z` like any other `ui-*` node — there is **no subflow
`.z` problem**. The definition node itself produces a `def:`-rooted subtree that
only `expandComponent` consumes (it is not mounted into a real region, so
`renderRegions` never emits it directly).

### v1 cut (scope of this epic)

- **Props in / events out.** Instances pass props; inner nodes' events route on the
  out-port with the `<instanceId>#<innerNodeId>` identity (instance recoverable from
  the id prefix — `componentId` already on `uiEventMessageSchema`).
- **No child-slot projection** (a `<slot>` an instance fills with its own children) —
  that is composition, deferred to **P142**.
- **No per-instance state** — presentational only in v1.
- **Sequenced after `ui-repeat`** (done) so the scope foundation is already proven.

## Consequences

- **P141 is resolved** with a decided substrate (B). It is retired into a concrete
  three-layer epic `nodes/ui-component`, layered schema → renderer → node+editor like
  every prior wave (`ui-repeat` P163→P164→P165; Tabs-1a P167→P168):
  - **P177** (schema, `verify:unit`): the two node schemas + the `def:` mount scope +
    the `prop`/`prop.<name>` scope-local kind (form-only) + a self-reference validation
    rule + fixtures.
  - **P178** (renderer, `verify:unit`): `expandComponent` (props→propScope→render
    `def:` subtree→re-id→flatten), `prop.<name>` resolution, nested + self-guard.
  - **P179** (node registration + editor + **browser proof**, `verify:browser`):
    register both node types + runtime bucketing; editor (definition default-slot
    container; instance `definitionId` picker + a `props` typedInput map); mount-tree;
    the end-to-end render proof.
- **Two contract additions only** — the `def:` mount scope and the `prop` binding
  kind — both small, local, with shipped precedent (ADR 0017). No data-model churn
  elsewhere; `{kind:"prop", …}` joins the binding union next to `{kind:"item"}`.
- **No subflow integration work** is taken on — the package keeps its single static
  flow-file read and never depends on Node-RED's wire-time subflow expansion.
- **Child-slot projection (composition) and per-instance state are explicitly out of
  scope for v1** and remain future work ([[P142]] et al.).
