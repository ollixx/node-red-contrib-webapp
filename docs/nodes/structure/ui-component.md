# ui-component (definition + instance)

> **Stub — to be filled during the Components wave (P177→P178→P179).** The
> contract is decided in [ADR 0020](../../adr/0020-component-model-dedicated-ui-component-node.md)
> (dedicated `ui-component` node pair; spike findings in
> [ADR 0019](../../adr/0019-component-substrate-subflow-vs-ui-component.md)).

A **Component** is a named, parametrised, reusable set of `ui-*` nodes — authored
once as a **`ui-component-definition`** and used many times as a
**`ui-component-instance`** with props. Reuses the `ui-repeat` render-time-scope
machinery ([ADR 0017](../../adr/0017-ui-repeat-template-container-render-time-scope.md)).

## Contract (per ADR 0020 — to be detailed as each layer lands)

- **`ui-component-definition`** — container-kind, off-canvas; children mount into
  `def:<componentId>/content`; never renders on its own. *(P177 schema; P179 node/editor.)*
- **`ui-component-instance`** — leaf with an outer `mount`, a `definition` reference, and a
  `props` map (name → value typedInput, any binding kind). *(P177 schema; P179 editor picker + props map.)*
- **`def:` mount scope** — new scope in the mount grammar. *(P177.)*
- **`prop` / `prop.<name>` binding kind** — scope-local, resolved at render time
  against the instance's `propScope` frame; `undefined` outside an instance. *(P177 form; P178 resolution.)*
- **`expandComponent`** — props→propScope→render `def:` subtree→re-id
  `<instanceId>#<innerNodeId>`→flatten into the instance's host region; nested +
  self-reference guard. *(P178.)*
- **v1 cut** — props in / events out; **no** child-slot projection (composition,
  P142); **no** per-instance state (presentational).

## Schema (P177 — shipped in `packages/schema`)

### `ui-component-definition`

A **container-kind** node, registered alongside `ui-container`/`ui-repeat`. Its
children mount into a fixed default slot named `content`, exported as the constant
`COMPONENT_DEF_SLOT = "content"` — the full mount string is `def:<componentId>/content`.
The definition is **off-canvas**: it has **no required outer `mount`/`app`**
(it never renders on its own — it exists only to be expanded by instances). The
node's own **`id` is its `componentId`**. The only other field is an optional
display `name` for the editor/structure sidebar.

### `ui-component-instance`

A **leaf-shaped** node (no children of its own) that **must** carry an outer
`mount`/`app` into a real route/container (like any mounted node). Fields:

- **`definition`** *(required string)* — the id of the `ui-component-definition` (P259/ADR 0038: bare reference name, formerly `definitionId` — legacy flows migrate on open+save)
  it instantiates.
- **`props`** *(map `name → value-binding`, default `{}`)* — each value is an
  ordinary value-binding of **any** binding kind (literal/state/store/query/item/…).
  Optional and may be empty.

### `def:` mount scope

`parseMountReference` (`packages/schema/src/validation.ts`) learns
`def:<componentId>/<slot>` as a **sibling** of `route:`/`dialog:`/`layout:`. It
parses/serialises **losslessly** (the `<target>/<region…>` grammar mirrors
dialog/layout); an unknown scope is still rejected. A `def:` mount is **resolved at
render time** by `expandComponent` (P178), so the AppModel-side resolver
(`resolveNamedMount`) intentionally does **not** anchor it into a route/dialog/layout.

### `prop` / `prop.<name>` binding kind

`prop` joins `SCOPE_LOCAL_BINDING_KINDS` (`packages/schema/src/contracts.ts`) as the
exact sibling of `item`/`index` (ADR 0017). `prop` alone is the whole prop value; an
optional dotted `path` (`prop.<name>`, one- or multi-level, e.g. `prop.address.city`)
selects a field — the `prop.` prefix is the **kind**, the `path` carries only the
field tail. This phase validates **form only**; resolution against the instance's
render-time `propScope` is P178. Outside any instance, `prop.<name>` resolves to
`undefined` (an editor-validateable misuse), mirroring `item` today.

### Self-reference validation

`validateComponentAcyclic(nodes)` is a **pure** function that reconstructs the
definition→definition instantiation graph (an instance inside definition *D*
referencing definition *T* is an edge *D → T*, where *D* is found by walking the
instance's `def:` mount/app chain) and rejects any cycle — a definition that
instantiates itself **directly or transitively** — with a clear error message. An
acyclic definition→instance graph is valid.

## Renderer (P178 — shipped in `packages/renderer`)

The renderer expands instances and resolves the `prop` kind. Both are modelled
**1:1 on `expandRepeat`** (ADR 0017) — composition over a new mechanism.

### `expandComponent`

When `renderRegions` enumerates a region's components, a `component-instance` (like
a `repeat`) carries **no rendered chrome** — it **expands in place**:

1. Read `props.definitionId` → find the `component-definition`. A missing/unknown
   definition (or absent `definition` reference) renders **nothing** (a defined "no output",
   not a crash — the editor/deploy layer flags the misuse).
2. Resolve the instance's **`bind` props** (each an ordinary typedInput, any binding
   kind, resolved against the **current** scope so a prop may itself bind
   `item.*`/`prop.*` of an enclosing repeat/instance) → one **`propScope` frame**
   `{ <name>: value, … }`. The definition reference rides in `props` (internal key `definitionId`), never `bind`, so it is
   not a prop.
3. Push the frame onto the render-time **`propScope` stack** (a sibling of
   `itemScope`, same immutable-per-clone discipline).
4. Render the definition's **`def:<definitionId>/content`** subtree (matched by the
   `def:` head, the `createRepeatChildMatcher` recipe) against the extended scope.
5. **Re-id** each rendered node **`<instanceId>#<innerNodeId>`** (the
   `<itemKey>#<childId>` repeat recipe) → unique, stable `data-webapp-node` ids so
   the keyed morph preserves unchanged instances.
6. **Flatten** the clones into the instance's host region (the caller flatMaps); the
   instance's **outer `mount`** is the bridge between "inside" and "outside", exactly
   like the `ui-repeat` template mount.

### `prop` / `prop.<name>` resolution

`resolveBinding`'s `prop` case is the exact sibling of `item`/`index`: it reads the
**top (innermost) `propScope` frame** and `getValueAtPath(frame, binding.path)` —
so a bare `prop` (path = the prop name, e.g. `title`) yields the whole prop value and
`prop.<a.b>` reaches into a structured value. **Outside any instance** (empty stack)
it resolves to `undefined` — a defined "no value" (the binding's `fallback` then
applies), never a throw, mirroring `item`.

### Nested + self-guard; definition never renders

- **Nested:** an instance (or a repeat) inside a definition's subtree expands
  recursively against the extended scope; its clones get this instance's id prefix on
  top of their own keying (`<outerId>#<innerId>#<leaf>`), exactly like nested repeats.
- **Self-guard:** `expandComponent` carries a `visitedDefinitions` list of the
  definition ids already on the active expansion path. A direct or transitive
  self-reference (an instance of a definition already being expanded) is **cut** —
  the branch terminates with no infinite expansion (a defined abort, not a hang). The
  schema's `validateComponentAcyclic` rejects such graphs at deploy; the renderer
  guard is the render-time backstop.
- **Definition never renders on its own:** a `def:`-rooted mount never resolves to a
  real route/dialog/layout region (the AppModel resolver deliberately refuses it), so
  `renderRegions` never enumerates a definition or its `def:` children directly — only
  `expandComponent` consumes them, via an instance.

### v1 cut

Props in / events out; **no** child-slot projection (composition, P142); **no**
per-instance state (presentational). The browser proof of the full flow is **P179**.

## Node registration + editor (P179 — shipped in `nodes/` + `resources/`)

Both node types live under `nodes/structure/` and register through the single
`registerNodeType` path in `nodes/webapp.js` (entries in `WEBAPP_NODE_TYPES`, the
`getDefinitionBuckets` component bucket, `toComponentDefinitions`, and
`runtimeNodeRegistry`). The `node-red.nodes` block in `package.json` maps both
files.

### Runtime bucketing

- The **definition's children** mount with a `def:<id>/content` string and bucket
  into the app by their **real `.z`** like any other `ui-*` node — there is no
  subflow `.z` problem.
- `toComponentDefinitions` maps `ui-component-definition` → renderer kind
  `component-definition` (with a self-anchoring `def:<id>` mount that never resolves
  to a real region) and `ui-component-instance` → kind `component-instance` (its
  `props` map becomes the component's `bind`; the definition reference rides in `props`). Only
  `expandComponent` consumes a definition's `def:`-rooted subtree; `renderRegions`
  never emits a definition directly.

### Editor — `ui-component-definition`

A `webapp structure` node. Off-canvas: **no** Parent-Slot field and **no**
outer-mount requirement (it never renders on its own). Fields: an optional display
`name` and the `uiId`. It is surfaced to **both** mount pickers as a container with a
single `content` slot under a top-level **"Komponenten"** group, so a child mounts
into `def:<id>/content` (the `slotMountHead` mechanism — the renderer's def-child
matcher is strict on the `def:` head). In a child node, bind a value to **Prop
(Component)** (the scope-local `prop` typedInput kind, sibling of Item/Index; an
optional dotted field path) to read the value the instance passes in.

### Editor — `ui-component-instance`

A `webapp structure` node mounted into a real route/container (the standard
button-first mount picker). Fields:

- **Definition** — a button-first reference picker (`installPickerField` with the
  `definitions` preset) listing every `ui-component-definition` by name/id. Required
  (`required: true` + a non-empty validator) → a missing/invalid reference is a
  visible deploy error.
- **Props** — a native `editableList` of name→value rows; each value is a full
  value-binding typedInput (any binding kind, incl. Store/Query/State/Prop/Item).
  Add/remove/reorder; persisted as a JSON object `{ name: <binding> }` on a hidden
  `props` input.
- Standard layout child-prop rows.

### Visible validation

- A missing/empty `definition` reference fails the editor's required-field check (the node is
  marked invalid, deploy blocked).
- `validateComponentAcyclic` (P177) is the deploy-time guard for a definition that
  instantiates itself directly or transitively — surfaced as a deploy error.

### Browser proof

`tests/e2e/nodes/view/ui-component.spec.ts`: a definition with two `ui-text`
children (`prop.title`/`prop.body`) + a `ui-button` child; two instances with
different props render their own two lines with the instance-specific values; a prop
bound to a store updates only the affected instance live; inner clones carry the
`<instanceId>#<innerNodeId>` identity (the inner event's sourceId).
