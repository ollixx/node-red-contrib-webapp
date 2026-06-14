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
- **`ui-component-instance`** — leaf with an outer `mount`, a `definitionId`, and a
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
The definition is **off-canvas**: it has **no required outer `mount`/`parent`**
(it never renders on its own — it exists only to be expanded by instances). The
node's own **`id` is its `componentId`**. The only other field is an optional
display `name` for the editor/structure sidebar.

### `ui-component-instance`

A **leaf-shaped** node (no children of its own) that **must** carry an outer
`mount`/`parent` into a real route/container (like any mounted node). Fields:

- **`definitionId`** *(required string)* — the id of the `ui-component-definition`
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
instance's `def:` mount/parent chain) and rejects any cycle — a definition that
instantiates itself **directly or transitively** — with a clear error message. An
acyclic definition→instance graph is valid.
