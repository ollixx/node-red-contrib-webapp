# ui-component-definition

A reusable, parametrised template of `ui-*` nodes — authored once, used many
times via `ui-component-instance`.

> Deutsch: [de/nodes/ui-component-definition.md](../de/nodes/ui-component-definition.md)

## Purpose

A **component** is a named, parametrised, reusable set of `ui-*` nodes.
`ui-component-definition` is the **template**: you author it once, mount child
nodes into its `content` slot, and each [`ui-component-instance`](ui-component-instance.md)
clones it with its own props. The definition is **off-canvas** — it never
renders on its own; it exists only to be expanded by an instance.

## When to use

- Build a small UI fragment (a card, a labelled field, a row) you want to reuse
  with different data in several places.
- Read the values an instance passes in: in a child node, bind a value to
  **Prop (Component)** (e.g. `title`, `address.city`).
- Not for per-instance state — v1 components are presentational (props in,
  events out; no child-slot projection, no own state).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and structure sidebar. | free text | — |
| **Node ID** (`uiId`) | The node's own id — this is the component's `componentId` that instances reference. | id | auto |

There is **no** Parent Slot: a definition is off-canvas and has no outer mount.
Mount child nodes into its `content` slot — shown under **Komponenten** in the
mount picker.

## Inputs

None — a definition is a template, not a runtime node. It has no input port and
receives no messages.

## Outputs / Events

None directly. Events fired by an instance's cloned children carry the
instance's identity (`<instanceId>#<innerNodeId>`) in their `sourceId`.

## Examples

### 1. A definition used by two instances

A definition with a `ui-text` bound to `prop.title`; two instances render it
with different `title` props.

Flow file: [`examples/guide/ui-component.json`](../../../examples/guide/ui-component.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-component.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideComponent/` — you see two
   cards, "First card" and "Second card", from the same definition.

## Related

- [`ui-component-instance`](ui-component-instance.md) — instantiates a definition
- [Theming & Components](../guides/theming-components.md) — reusable components
- Contract doc (internal, English): `docs/nodes/structure/ui-component.md`
