# ui-breadcrumb

A hierarchical path trail showing where the user is in the app.

> Deutsch: [de/nodes/ui-breadcrumb.md](../de/nodes/ui-breadcrumb.md)

## Purpose

`ui-breadcrumb` renders a **breadcrumb trail** — a horizontal sequence of labels
separated by a divider, showing the user's position in the app hierarchy. **Every
item is clickable** and emits a `click` event on the output port. The current
page can be marked `active` (rendered differently, but still clickable). Items
come either from an `items` array/binding or, in child-node mode, from mounted
child nodes.

## When to use

- Show a positional trail (Home › Customers › Details) at the top of a route.
- Let the user jump back up the hierarchy — wire `click` → `ui-action`.
- For primary navigation between top-level areas, use [`ui-menu`](ui-menu.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Breadcrumb N` |
| **Parent Slot** (`mount`) | The slot this mounts into. Required. | mount path | — |
| **Mode** (`layout`) | Where items come from: the default *Items / Binding* mode, or *Child Nodes (Slots)* where mounted children become items. | `""` (items/binding), `breadcrumb` (child slots) | items/binding |
| **Items** (`items`) | The path elements — a JSON array or a binding (Items/Binding mode only). String items (`["Home","Details"]`) use the string as both label and action; object items are `{ "label", "action"?, "active"? }`. | `literal` (JSON), `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | `[]` |
| **Separator** (`separator`) | The divider between items (Items/Binding mode). A non-empty string overrides Shoelace's native `/`; empty → `/`. | free text | `/` |
| **Visible** / **Color** | Base fields. | — | — |

`Disabled` and `Size` are N/A (a breadcrumb reflects navigation and has no
disabled state or size steps). In child-node mode, mount item nodes into the
`default` slot and an optional separator node into the `separator` slot.

## Inputs

`ui-breadcrumb` **has an input port**:

- **`msg.payload`** — replaces the items list (an array of
  `{ label, action?, active? }` or a string array). A bound `items` is restored
  on the next binding resolution.
- **`msg.ui.patch`** — overrides node fields (e.g. `items`, `separator`).
- **`msg.ui.component.op`** (`show`, `hide`) — toggles the whole trail's
  visibility.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

`ui-breadcrumb` has an output port. **Every** item click (including `active`
items) emits:

| Event | When | `msg.ui` fields |
|---|---|---|
| `click` | user clicks any item | `event: "click"`, `params.action` (the item's action or label), `clientId`, `sourceId`, `appId` |

There is **no `navigate` event** — even an item whose `action` is a route path
fires `click`. Wire `click` → `ui-action` (`navigate`, `to: msg.ui.params.action`)
to move. In child-node mode `params.action` is the clicked child's node id.

## Examples

### 1. A three-level trail with the current page active

`Home › Customers › Details`, with "Details" marked active; clicks emit `click`.

Flow file: [`examples/guide/ui-breadcrumb.json`](../../../examples/guide/ui-breadcrumb.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-breadcrumb.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideBreadcrumb/` — the trail
   renders with "Details" as the current page.

## Related

- [`ui-menu`](ui-menu.md) — primary route navigation
- [Navigation & Dialogs](../guides/navigation-dialogs.md) — routes and navigate modes
- [`ui-action`](ui-action.md) — turns a `click` into a route change
- [Bindings & State](../guides/bindings-state.md) — the binding kinds, stores
- Contract doc (internal, German): `docs/nodes/navigation/ui-breadcrumb.md`
