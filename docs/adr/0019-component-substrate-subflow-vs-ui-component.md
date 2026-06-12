# ADR 0019: Component substrate — Node-RED subflow vs. a dedicated `ui-component` node

- Status: draft (feasibility-spike output — input to the Component follow-up ADR/epic)
- Date: 2026-06-12
- Spike: P166 (`docs/roadmap/aspects/rendering/P166-component-substrate-subflow-feasibility-spike.md`)
- Feeds: P141 Components concept (`../roadmap/aspects/rendering/deferred/P141-components-reusable-node-sets.md`)
- Builds on: [ADR 0017](0017-ui-repeat-template-container-render-time-scope.md) (render-time
  scope, template clone + re-id, keyed identity — the proven prior art this spike
  leans on), [ADR 0014](0014-mount-picker-two-column-tree.md) (mount tree),
  [ADR 0001](0001-initial-architecture.md) (mount-not-wires, registry→AppModel→snapshot
  pipeline).

> **This is a research finding, not a node contract.** It adds no production
> schema/runtime/renderer/editor code. It answers one question — *can a Node-RED
> subflow be the substrate for Components?* — with a per-test verdict and a
> reasoned **A (subflow) vs. B (dedicated `ui-component` node)** recommendation.
> The implementation of whichever path wins is a separate epic, sequenced after
> `ui-repeat` (the scope foundation).

## Context

A **Component** (P141) is a named, parametrised, reusable **set of ui-\* nodes** —
authored once as a **definition**, used many times as an **instance** with props.
The owner direction (2026-06-12): the props are a **named render-time scope**
`prop.<name>`, the exact sibling of `ui-repeat`'s `item`/`index` scope (ADR 0017),
and we should **check the Node-RED subflow as the substrate first** (node-red-first):
if a subflow can cleanly carry an inner mount-subtree + typed props + a single
outer mount point, take the subflow road (Node-RED gives instantiation and
namespacing for free); otherwise fall back to a dedicated `ui-component` node.

To judge that, the spike traced the live pipeline by reading code, end to end:

| Stage | File | What it does that matters here |
|---|---|---|
| node config → definition | `nodes/webapp.js` `readDeployDefinitions` (≈L2131) + `getDefinitionBuckets` (≈L2310) | reads the flow file, maps each ui-\* node via `mapConfig`, **buckets nodes into an app by `entry.z` (the flow/tab id)** |
| definitions → registry → AppModel | `packages/runtime/src/registry.ts` | dedupe by id, resolve each component's `mount`, emit a **flat** `components: ComponentDefinition[]` |
| mount grammar | `packages/schema/src/validation.ts` `parseMountReference` (L105) | scopes are exactly `route:` / `dialog:` / `layout:` / bare-named (`container:<id>/<slot>`); **no other scope** |
| AppModel → snapshot (tree) | `packages/renderer/src/renderer.ts` `renderRegions` (L1005), `toRenderedComponent` (L784), `expandRepeat` (L1134) | builds the nested tree purely from `mount` strings; **`expandRepeat` clones a template subtree, pushes a render-time scope frame, and re-ids each clone `<itemKey>#<childId>`** |

The AppModel hierarchy is a **flat list keyed by mount strings** — there is no
parent-pointer tree; nesting is reconstructed at render time by matching mounts
(`createContainerMountMatcher`, renderer.ts:1215). This single fact drives every
verdict below.

## The three feasibility tests

### Test 1 — Mount-subtree inside the substrate — **works (model side); does-not-work for a subflow specifically**

*Can a set of ui-\* nodes form an internal `mount`/`parent` hierarchy, with
mount-not-wires holding inside the unit?*

The **model** already supports this with zero new machinery. A container plus its
children is exactly an internal subtree today: children carry
`mount: "container:<containerId>/content"`, and `createContainerMountMatcher`
(renderer.ts:1215) + the recursive `renderRegions`/`container` case
(renderer.ts:874–894) assemble it. `ui-repeat` proves an *anonymous* root subtree
(`REPEAT_SLOT = "content"`) can be cloned wholesale. So an inner mount-subtree is
**works** as a concept.

The blocker is **subflow-specific**. App membership is by flow id: `getDefinitionBuckets`
takes `appFlowId = matchingApp.z` and keeps nodes where `entry.z === appFlowId`
(webapp.js:2328). Nodes authored **inside a subflow definition** carry
`z = "<subflowId>"` (the subflow's own id), **not** the app's flow tab. They are
also stored in the flow file **once** — as the definition template — regardless of
how many instances exist. So:

- the inner nodes never land in the app's bucket (wrong `.z`), and
- `readDeployDefinitions` reads the flow file directly off disk (webapp.js:2139) —
  it has **no expansion of subflow instances into per-instance node sets**; Node-RED
  performs that expansion only in its *runtime wiring*, which this package
  deliberately bypasses (mount-not-wires).

Verdict: **the inner tree as a data model = works; getting a subflow's inner nodes
into the AppModel at all = does-not-work without effort that amounts to
re-implementing subflow expansion ourselves.**

### Test 2 — One outer mount point — **does-not-work (subflow); works for a dedicated node**

*Can the unit **instance** mount as a single element into a real route so the inner
tree appears there? How does the inner root bind to the outer mount?*

Mounting *one element* into a route is trivial — `route:/x/content` is the everyday
case. The hard half is **binding the inner root to that outer point**. The renderer
has exactly one re-anchoring primitive: `expandRepeat` (renderer.ts:1134), which
takes a template subtree addressed by an internal mount (`container:<repeatId>/content`),
renders it against a scope, and **flattens the clones into the host region** — the
template's own mount is the bridge between "inside" and "outside". A Component
instance is the same move: render the definition subtree, splice it at the
instance's outer mount.

For a **dedicated `ui-component` node** this is a clean, small addition: the
definition's children mount into a new free root (e.g. `def:<componentId>/content`,
a sibling of `layout:`/`container:` in the mount grammar — one new scope in
`parseMountReference`), and an `expandComponent` (modelled on `expandRepeat`)
splices that subtree at the instance's `mount`. **works.**

For a **subflow** it does-not-work, and the reason is structural, not effort:
- A subflow **instance** is a single opaque node in the flow JSON; its `type` is the
  generated `subflow:<id>`, which is **not** in `WEBAPP_NODE_TYPES`, so
  `readDeployDefinitions` filters it out entirely (webapp.js:2145). The instance is
  invisible to the runtime.
- Even if we registered it, there is **no inner root to bind**: the subflow's inner
  nodes mount via whatever mount strings they carry, but those strings are authored
  **once** in the definition and cannot reference the *instance's* outer mount —
  there is no per-instance rewrite step, because we never expand instances.

So the subflow gives us neither end of the bridge.

### Test 3 — Typed props — **works for a dedicated node (mechanism already exists); does-not-work for a subflow**

*Can props be passed as **typedInput** bindings (any binding kind, not just strings)
and resolved inside as a `prop.<name>` scope?*

The scope mechanism is **already shipped and proven** by ADR 0017. The renderer
carries a `BindingSources.itemScope` frame stack (renderer.ts:224–231); `resolveBinding`
resolves the scope-local kinds `item`/`index` against the top frame (renderer.ts:515–535);
`SCOPE_LOCAL_BINDING_KINDS` (contracts.ts:51) is the extension point. A `prop` kind
is a **direct sibling**: add `"prop"` to `SCOPE_LOCAL_BINDING_KINDS`, carry a
`propScope` frame next to `itemScope`, resolve `prop.<name>` against it — a handful
of lines mirroring the `item` case. The **instance** supplies prop *values* as
ordinary typedInputs (every binding kind), resolved once and pushed onto the frame
exactly as `expandRepeat` resolves `items` then pushes `{item,index}` (renderer.ts:1141–1158).
For a dedicated node: **works (with effort ≈ the `item`/`index` slice already done once).**

For a **subflow**, Node-RED's native prop surface is **subflow env vars** — and they
are **strings/typed-env values consumed by the subflow's own runtime**, delivered
through `msg`/`env.get()` at *message* time, on the **wire** path. They are not
visible to `readDeployDefinitions`' static flow-file read, and there is no point at
which a per-instance env value could be lifted into a render-time `prop` scope,
because (Tests 1–2) the instance is never expanded into a node set in the first
place. Routing props through env would also re-introduce the **wire path for
structure**, which mount-not-wires (ADR 0001) exists to forbid. **does-not-work.**

## Secondary findings

- **Namespacing / identity.** The premise "a subflow gives each instance a
  collision-free id namespace for free" is *true inside Node-RED's runtime* but
  **irrelevant here**, because we read the flow file statically and never see the
  per-instance expansion. A dedicated node must synthesise identity — but the recipe
  already exists: `expandRepeat` composes `<itemKey>#<childId>` (renderer.ts:1164)
  to keep clones unique and stable for the keyed morph. `<instanceId>#<innerNodeId>`
  is the identical pattern. So the supposed subflow advantage **does not actually
  accrue** to this architecture, while the dedicated-node cost is **already paid**.
- **Structure sidebar.** `packages/editor/src/structure-view.ts` builds the sidebar
  from compiled mounts, not wires (`StructureNodeKind` includes `component`), so it
  *can* show a definition subtree once one exists in the model — but it has **no
  notion of definition-vs-instance** today. Both A and B need a new sidebar concept;
  neither gets it free. A subflow's internals are authored on a separate Node-RED
  subflow canvas, *outside* this package's structure view entirely — arguably worse
  for "see into the definition".
- **Events with instance context.** Events already carry `componentId`
  (`uiEventMessageSchema`, contracts.ts:808–811) and route on the out-port by node
  id. With dedicated-node identity `<instanceId>#<innerNodeId>`, the instance is
  *recoverable from the id prefix* for free. A subflow instance, being invisible to
  the runtime, gives no such handle.

## Decision — **Recommendation B: a dedicated `ui-component` node (definition + instance)**

A Node-RED subflow **cannot** be the substrate for Components. The block is not
effort, it is an architectural mismatch: this package deliberately reads the flow
file **statically** and reconstructs hierarchy from **mount strings**, bypassing
Node-RED's wire-time runtime — which is exactly where subflow instantiation,
env-prop delivery, and id namespacing live. Every "free" subflow benefit is realised
only in machinery we have chosen not to use, while the inner nodes' wrong `.z`,
the opaque instance node (filtered out by type), and env-props-on-the-wire each
independently break a feasibility test.

Per-test summary:

| Test | Subflow substrate | Dedicated `ui-component` node |
|---|---|---|
| 1. Mount-subtree | **does-not-work** (inner `.z` ≠ app flow; definition stored once, never expanded) | **works** (it is a container subtree; `ui-repeat` proves an anonymous cloned root) |
| 2. One outer mount point | **does-not-work** (instance node filtered by type; no inner-root rebind) | **works** (new `def:` mount root + `expandComponent` modelled on `expandRepeat`) |
| 3. Typed props | **does-not-work** (env = strings on the wire, invisible to the static read) | **works** (add `prop` to `SCOPE_LOCAL_BINDING_KINDS`; a `propScope` sibling to `itemScope`) |

Conversely, **B is small and well-precedented** — it is largely a *third application*
of the ADR 0017 scope+clone+re-id machinery (after `ui-repeat` itself), not new
invention.

### Sketch of the dedicated-node mechanism (for the follow-up epic)

The follow-up ADR/epic should specify, concretely:

1. **Two roles, one or two node types.** A `ui-component` **definition** (its
   children mount into a new free root `def:<componentId>/content` — one new scope
   added to `parseMountReference`, a sibling of `layout:`) and a `ui-component`
   **instance** (a leaf-shaped node that itself carries an outer `mount` into a real
   route/container, plus a `definitionId` and a `props` map). The definition is
   **off-canvas** — mounted into nothing real, so it never renders on its own.
2. **Expansion = `expandComponent`** modelled 1:1 on `expandRepeat` (renderer.ts:1134):
   resolve the instance's `props` typedInputs → push a single `propScope` frame →
   render the `def:<id>/content` subtree against the extended scope → re-id each
   rendered node `<instanceId>#<innerNodeId>` → flatten into the instance's host
   region. Nested/recursive components recurse exactly like nested repeats
   (renderer.ts:1172), with an explicit self-reference guard.
3. **`prop` binding kind** added to `SCOPE_LOCAL_BINDING_KINDS` (contracts.ts:51) and
   resolved in `resolveBinding` against the top `propScope` frame — the `item`/`index`
   case (renderer.ts:515–535) is the template. Outside any component instance,
   `prop.<name>` → `undefined` (editor-validateable misuse), mirroring `item` today.
4. **Runtime bucketing.** `getDefinitionBuckets` (webapp.js:2335) and
   `WEBAPP_NODE_TYPES` learn the two new node types; the definition's children bucket
   into the app by their (real-flow) `.z` like any other ui-\* node — **no subflow
   `.z` problem** because the definition lives on the normal canvas.
5. **v1 cut (per P141):** props in / events out; **no** child-slot projection
   (composition is P142), **no** per-instance state (presentational only). Sequence
   **after `ui-repeat`** so the scope foundation is already proven in production.

This keeps Components inside the existing mount-not-wires, static-read,
mount-string-tree architecture, and reuses the exact machinery ADR 0017 introduced
rather than importing Node-RED's parallel subflow runtime.

## Consequences

- **P141 unblocked with a decided substrate (B).** The follow-up is a dedicated
  `ui-component` definition/instance node pair in its own epic, sequenced after the
  `ui-repeat` wave, layered schema → renderer → editor/node like every prior epic.
- **One new mount scope** (`def:`) and **one new scope-local binding kind** (`prop`)
  are the only contract additions; both are small, local extensions of existing
  enums/grammar with shipped precedent.
- **No subflow integration work** is taken on — the package keeps its single static
  flow-file read and never depends on Node-RED's wire-time subflow expansion.
- **This ADR changes no code.** It records the spike result only; `pnpm validate`
  stays green.
