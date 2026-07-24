# ui-list

Renders a styled list from a data array with a fixed item schema, optional single-select.

> Deutsch: [de/nodes/ui-list.md](../de/nodes/ui-list.md)

## Purpose

`ui-list` renders a **structured list** at a mount point. Items come from the
`items` binding — a static array or a live state/query/store/context value. Each
item is either a **string** (shorthand for the label) or an **item object** with
a fixed schema (`id`/`label`/`value`/`icon`). That schema is the **contract
between your data and the rendered row** — ui-list does no implicit field
guessing, but the **item-field mapping** lets you say which raw-entity field is
the label/value/id/icon. A display type controls the look; the list can be made
**selectable** (single-select). Clicks and selection changes are emitted as
events on output ports.

## When to use

- Show a polished, backend-styled list whose data fits the item schema (menus,
  quick picks, category lists with a count badge).
- Make one row selectable and mirror the selection into a store (`selectable` +
  `selectedId`).
- For **rich or varying** row content (cards with buttons) use `ui-repeat`; for
  **columns** use [`ui-table`](ui-table.md). "Tabular" is not a ui-list option.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `List N` |
| **Parent Slot** (`mount`) | The slot this list mounts into. Required. | mount path | — |
| **Items** (`items`) | The structural array source. Required. Scalar literals are hidden. | `json` (static array), `state`, `query`, `store`, `routeParam`, `reactive`, `msg`, `flow`, `global`, `jsonata`, `env` | none (empty list) |
| **Display Type** (`displayType`) | Semantic look intent (backend-mapped, not a colour). | `plain` (default), `divided` (separators), `grouped` (bordered cards), `actionable` (hover/focus affordance) | `plain` |
| **Ordered list (ol)** (`ordered`) | Switches `ul` ↔ `ol` (numbered). | checkbox | off |
| **Value display** (`displayValue`) | How each row's `value` is shown (value is always in the event regardless). | `none`, `secondary` (trailing text), `badge` (pill) | `none` |
| **Badge Variant** (`badgeVariant`) | Badge colour — only when `displayValue = badge`. | `neutral`, `primary`, `info`, `success`, `warning`, `danger` | `neutral` |
| **Label / Value / Id / Icon Field** | Item-field mapping (P208): which flat field of a raw entity is the label/value/id/icon. Flat names only (no dot path). | field names | `label` / `value` / `id` / `icon` |
| **Selectable** (`selectable`) | Turns on single-select (a click marks the row selected). | checkbox | off |
| **Selected (id)** (`selectedId`) | Two-way binding to the selected row's `id` — only relevant when selectable. Reads the selection from the bound store/state and writes it back on change. | `state`, `store`, `query`, `routeParam`, literal | none |
| **Events** (`events`) | `itemClick` (always available) and `itemSelect` (only meaningful with selectable) — each enabled event adds an output port. | checkboxes → ports | none |
| **Visible / Disabled / Color** | Base fields (bindable). `disabled` locks row interaction; a no-op without active events. | binding / value | shown / enabled / theme |
| **Order / Row / Col / spans / X·Y** | Placement in the parent slot. | numbers | canvas-y |

`Size` is N/A — density is governed by **Display Type**.

## Item schema — the data model

`items` resolves to an **array**. Each element is a **string** (shorthand for
`{label}`) or an **object**:

| Field | Type | Required | Role |
|---|---|---|---|
| `label` | string | yes (object form) | the row's primary text (the string shorthand sets this) |
| `id` | string | no (else index) | identity — carried as `rowId` in events and used as the render key |
| `value` | string / number | no | application value — always in the event (`row.value`); shown per `displayValue` |
| `icon` | string | no | leading icon (an icon name of the app icon set) |

A non-array root renders an empty list (no crash). A missing `label` renders `?`
for that row only. Extra fields are ignored — you can bind a whole DB row and use
the **field mapping** to pick which field is which; `itemClick.row` still carries
the full entity.

## Inputs

`ui-list` **has an input port**. On a message:

- **`msg.payload`** (non-`null`) sets `items` and pushes a snapshot to all
  clients.
- **`msg.ui.patch`** overrides fields (e.g. `items`, `displayType`); binding
  fields (`items`) as a binding object.
- **Component-state ops** (`msg.ui.component.op`): `show` / `hide`.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

One output port per enabled event:

| Event | When | `msg.ui` fields |
|---|---|---|
| `itemClick` | any row click (regardless of selectable) | `event`, `params: { rowId, row }`, `clientId`, `sourceId`, `appId` |
| `itemSelect` | selection changes (only when selectable) | same payload |

`rowId` is the item's `id` (else the index); `row` is the full element including
`value`. `itemClick` fires on every click; `itemSelect` fires only when
`selectable` is on and the selection changes — and pairs with the `selectedId`
write-back (wire `itemSelect` → `ui-store` set).

## Examples

### 1. A selectable list with a badge value

Five static items with a numeric `value` shown as a badge; the list is
selectable and its selection is mirrored into a store, with `itemSelect` wired to
a debug node.

Flow file: [`examples/guide/ui-list.json`](../../../examples/guide/ui-list.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-list.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideList/` — click a row to select
   it (it highlights); the `itemSelect` payload appears in the debug sidebar.

## Related

- [Displaying data](../guides/displaying-data.md) — the query loop, tables, lists
- [Actions & Events](../guides/actions-events.md) — wiring `itemClick`/`itemSelect`
- [`ui-table`](ui-table.md) — columns; `ui-repeat` — arbitrary subtree per item
- Contract doc (internal, German): `docs/nodes/display/ui-list.md`
