# ui-component-instance

Places a `ui-component-definition` at a real spot, passing it props.

> Deutsch: [de/nodes/ui-component-instance.md](../de/nodes/ui-component-instance.md)

## Purpose

`ui-component-instance` **uses** a [`ui-component-definition`](ui-component-definition.md):
it mounts into a real route/container slot, references a definition, and passes
it a **props** map (name → value, any binding kind). At render time the
definition's subtree is cloned in place with those props; each inner node is
re-id'd `<instanceId>#<innerNodeId>` so instances stay independent.

## When to use

- Reuse a component definition wherever you need it, each time with its own props.
- Bind a prop to a store/query so only that instance updates live.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and pickers. | free text | — |
| **Node ID** (`uiId`) | The instance's own id (its clones are prefixed with it). | id | auto |
| **Parent Slot** (`mount`) | Where the instance renders — a real route/container slot picked via the mount tree. Required. | slot path | — |
| **Definition** (`definition`) | The `ui-component-definition` to expand here, chosen from a picker. Required — a missing/invalid reference is a deploy error. | definition reference | — |
| **Props** (`props`) | A list of name → value rows; each value is a full binding (literal, store, query, state, prop, item, …). The definition's children read them via **Prop (Component)**. | name → value map | `{}` |
| **Placement** (`order` / `row`·`col` / …) | Position within the parent's layout; which fields appear depends on the parent's preset. | numbers | canvas order |

## Inputs

None — an instance is a render-time construct, not a runtime node. It has no
input port.

## Outputs / Events

None on the instance itself. Events from the cloned inner nodes carry the
instance identity (`<instanceId>#<innerNodeId>`) in their `sourceId`.

## Examples

### 1. Two instances of one definition

Two instances of the same definition, each with a different `title` prop.

Flow file: [`examples/guide/ui-component.json`](../../../examples/guide/ui-component.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-component.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideComponent/` — two cards,
   "First card" and "Second card", from one definition.

## Related

- [`ui-component-definition`](ui-component-definition.md) — the template
- [Theming & Components](../guides/theming-components.md) — reusable components
- Contract doc (internal, English): `docs/nodes/structure/ui-component.md`
