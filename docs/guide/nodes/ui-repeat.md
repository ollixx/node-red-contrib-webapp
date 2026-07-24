# ui-repeat

Clones a child template once per item of a bound collection — transparent iteration.

> Deutsch: [de/nodes/ui-repeat.md](../de/nodes/ui-repeat.md)

## Purpose

`ui-repeat` renders **a child subtree N times from data**. It binds to a list (or
object) via `items` and the renderer **clones the template** — the children
mounted in its `content` slot — once per element. Each clone gets a **render-time
scope** holding the current element, which its children read through the `item` /
`index` binding kinds. Unlike [`ui-list`](ui-list.md) (a leaf widget with a fixed
`{id,label,value,icon}` schema and list chrome), `ui-repeat` repeats an
**arbitrary** subtree.

`ui-repeat` is **transparent** (ADR 0025): it adds **no wrapper** around the
clones — it only iterates. The cloned children flow straight into the parent
region where the repeat sat. Layout and chrome (card, panel, side-by-side) are
the job of an explicit `ui-container` — either **around** the repeat (arranging
all clones) or **as the one child** of the repeat (grouping each item's fields
into a card/row).

## When to use

- Render a variable-length list of rich rows (cards with buttons, mixed content).
- Nest repeats to render grouped data (customers, each with their orders).
- For a plain styled list with a fixed schema use [`ui-list`](ui-list.md); for a
  columnar grid use [`ui-table`](ui-table.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Repeat N` |
| **Parent Slot** (`mount`) | The slot this repeat mounts into. Required. | mount path | — |
| **Items** (`items`) | The collection to iterate. Required. Resolves to an array (an object is iterated as `{key, value}` entries; reactive → re-render). | `json`/literal, `state`, `query`, `store`, `routeParam`, `reactive`, `msg`, `flow`, `global`, `jsonata`, `env` | — |
| **Key Field** (`keyField`) | Field used as the stable per-instance key (keyed morph — focus/scroll survive reorder). | field name | array index |
| **Scope Name** (`itemName`) | Alias naming this repeat's item scope (the `v-for="customer in customers"` model). Lets a descendant address *this* repeat's item by name, even past inner repeats. Must be an identifier. | identifier | none (innermost only) |
| **Visible** (`visible`) | Render gate (bindable). | binding | shown |
| **Order / Row / Col / spans / X·Y** | Placement of the repeat in the parent slot. | numbers | canvas-y |

`Disabled`, `Color` and `Size` are N/A — a transparent iterator has no
interactive state and renders no chrome of its own.

## Item scope (in the children)

Inside the template, children bind **relative to the current element**:

- **Item (Repeat)** — the whole element; an optional dotted path selects a field
  (`name`, `address.city`). Empty path = the whole element.
- **Index (Repeat)** — the zero-based position (path-less).

The scope is render-time (like `routeParam`) — no persistence, no store side
effect. Outside a `ui-repeat`, `item`/`index` resolve to `undefined` (the editor
shows a hint). With **nested** repeats the generic `item`/`index` mean the
**innermost** frame; give an outer repeat a **Scope Name** to address it by name
(`Item (customer)`), or in a reactive expression use `scope("customer").name`.
The scope propagates through child-bearing nodes (containers, tabs, accordions)
too, not only direct children.

## Inputs

`ui-repeat` **has an input port** (wire path mirrors `ui-list`): a `msg.payload`
array sets `items` and pushes a fresh snapshot. There is **no** message fan-out to
the child nodes — "one at a time" delivery is the render iteration, not a wire
split. `msg.ui.patch` overrides fields.

## Outputs / Events

None — `ui-repeat` has no output port and emits no events.

## Examples

### 1. Simple — repeat over a list

A static array of `{name, qty}` objects; two text nodes per item read
`item.name` and `item.qty`.

Flow file: [`examples/guide/ui-repeat.json`](../../../examples/guide/ui-repeat.json)

### 2. Nested — named scopes

An outer repeat (`itemName = customer`) over customers, each holding an inner
repeat (`itemName = order`) over `item.orders`. A deep child reads the outer
customer's name via `Item (customer)` and the inner order's total via the
innermost `Item (Repeat)`.

Flow file: [`examples/guide/ui-repeat-nested.json`](../../../examples/guide/ui-repeat-nested.json)

### 3. With a container — one card per item

The repeat's single child is a `ui-container` (card variant); the per-item fields
mount into the card, so each item renders as its own card.

Flow file: [`examples/guide/ui-repeat-container.json`](../../../examples/guide/ui-repeat-container.json)

Import instructions (each example):

1. In Node-RED open the menu (☰) → **Import**.
2. Select the JSON file (or paste its content) → **Import**.
3. Click **Deploy**.
4. Open the app root printed in the tab's info (e.g.
   `http://<your-node-red>:1880/webapp/guideRepeat/`).

## Related

- [Displaying data](../guides/displaying-data.md) — the query loop, repeat, item bindings
- [Bindings & State](../guides/bindings-state.md) — the `item`/`index` scope-local kinds
- [`ui-list`](ui-list.md) / [`ui-table`](ui-table.md) / `ui-container`
- Contract doc (internal, German): `docs/nodes/display/ui-repeat.md`
