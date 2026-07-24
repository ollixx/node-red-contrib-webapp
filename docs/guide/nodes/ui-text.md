# ui-text

Renders a single bound text value at a mount point — the workhorse display node.

> Deutsch: [de/nodes/ui-text.md](../de/nodes/ui-text.md)

## Purpose

`ui-text` shows one **text value** in a slot. The value is bindable — a static
literal, a reactive store value, a query result, a route parameter, a
server-resolved context value, or a value pushed in on a message. Two orthogonal
axes drive the look: **Style** picks the typographic *role* (heading, body,
caption, label, code — and the HTML element that renders) and **Variant** picks
the semantic *colour* (like `ui-button`/`ui-badge`). A second display mode turns
the same node into a read-only labelled form row.

## When to use

- Show a label, heading, paragraph, or any single dynamic value in a route,
  dialog, or container slot.
- Mirror a store value or query field live (it re-renders when the source
  changes).
- Show a read-only field (e.g. an `_id`) that must line up flush with real
  inputs in a form — use **Display: Form field**.
- For repeating rows of data use `ui-table`, `ui-list` or `ui-repeat` instead;
  `ui-text` renders one value.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Text N` |
| **Parent Slot** (`mount`) | The slot this text mounts into. Required. | mount path `<type>:<id>/<slot>` | — |
| **Text / value** (`value`) | The value to display. Bindable via the canonical value-binding type set. | `string`, `number`, `boolean`, `json`, `timestamp` (static); `store`, `query`, `routeParam`, `reactive` (live); `flow`, `global`, `env` (server-resolved once); `msg`, `jsonata` (message-driven). `item`/`index`/`prop` appear only inside a `ui-repeat`/component scope. | literal `""` |
| **On Missing** (`onMissing`) | What to show when the bound value is `null`/absent. | `Marker` (show `?`) · `Ignore` (render empty) | `Marker` |
| **Style** (`style`) | Typographic role → the HTML element rendered. | `heading-1`…`heading-3`, `body`, `caption`, `label`, `code` | `body` |
| **Variant** (`variant`) | Semantic colour (not the element). | `default`, `muted`, `primary`, `success`, `warning`, `danger`, `neutral` | `default` |
| **Display** (`display`) | Presentation mode. | `text` (free display text) · `formField` (read-only labelled row styled like the inputs) | `text` |
| **Field Label** (`label`) | Left-hand label — only shown/relevant in **Form field** mode. | free text | empty |
| **Visible** (`visible`) | Render gate — bindable; `false` hides the node. | binding / boolean | shown |
| **Order / Row / Col / spans / X·Y** | Placement in the parent slot; which rows show depends on the slot's layout preset. | numbers | canvas-y |

`Disabled` and `Size` do not apply to a text node (it has no interactive state;
sizing is governed by **Style**).

## Inputs

`ui-text` **has an input port**. On a message:

- **`msg.payload`** (non-`null`) sets the displayed `value` (held on the server)
  and pushes a fresh snapshot to all connected clients — this is the `msg`
  value-source mode.
- **`msg.ui.patch`** overrides fields of the node definition (e.g. `value`,
  `variant`); binding fields must be passed as a binding object.
- **Component-state ops** (`msg.ui.component.op`): `show` / `hide` toggle
  visibility.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

None — `ui-text` has **no output port** and emits no events. It is purely
presentational.

## Examples

### 1. Static and store-bound text

Two text nodes: a heading (static literal) and a body value bound to a store,
updated live by an inject.

Flow file: [`examples/guide/ui-text.json`](../../../examples/guide/ui-text.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-text.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideText/` — you see the heading
   and the body value; click the inject to change the store value and watch the
   body update live.

## Related

- [Displaying data](../guides/displaying-data.md) — the query loop, tables, lists
- [Bindings & State](../guides/bindings-state.md) — the binding kinds, stores
- [Theming & Components](../guides/theming-components.md) — variants vs. colours
- Related display nodes: `ui-badge`, `ui-table`, `ui-list`, `ui-repeat`
- Contract doc (internal, German): `docs/nodes/display/ui-text.md`
