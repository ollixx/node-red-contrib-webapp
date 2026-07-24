# ui-table

Renders tabular data with configurable columns and an optional row-select event.

> Deutsch: [de/nodes/ui-table.md](../de/nodes/ui-table.md)

## Purpose

`ui-table` renders an **array of row objects** as a table. The row data comes
from the `rows` binding (typically a query or store result, or a static array);
the column structure is declared with `columns`. A column can be a plain data
field or a typed renderer (text, number, date, checkbox, action buttons) and can
be made sortable/filterable. When the user clicks a row, the node can emit a
`rowSelect` event on an output port — the usual driver of a master/detail flow.

## When to use

- Show a list of records as a grid (customers, orders, log entries).
- Drive a detail view: wire `rowSelect` → `ui-action` (navigate) or
  `ui-store` (set selection) → `ui-query` (load the detail).
- For a card/free-form layout of a list use `ui-list`; to lay out arbitrary
  child nodes per item use `ui-repeat`.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Table N` |
| **Parent Slot** (`mount`) | The slot this table mounts into. Required. | mount path `<type>:<id>/<slot>` | — |
| **Columns** (`columns`) | Column definition. Required — at least one column. Short form: comma-separated keys (the key is also the header). Full form: a JSON array of objects with `key`, `label`, `type` (`text`/`number`/`date`/`checkbox`/`actions`), `sortable`, `filterable`, `width`. | e.g. `name,email,status` or a JSON array | — |
| **Rows** (`rows`) | The structural data source — an array of row objects the table renders itself. Bindable via all standard kinds. | `json`/literal (static array), `state`, `query`, `store`, `routeParam`, `reactive`, `msg`, `flow`, `global`, `jsonata`, `env` | none (empty table) |
| **Events** (`events`) | Enables the `rowSelect` output port. | checkbox → output port | off |
| **Visible / Disabled / Color** | Base fields: render gate, disabled state, colour override — all bindable. | binding / value | shown / enabled / theme |
| **Order / Row / Col / spans / X·Y** | Placement in the parent slot; which rows show depends on the layout preset. | numbers | canvas-y |

`Size` does not apply to a table (advanced N/A). Missing row keys render as an
empty cell.

## Inputs

`ui-table` **has an input port**. On a message:

- **`msg.payload`** (non-`null`) sets `rows` to that value and pushes a fresh
  snapshot to all connected clients.
- **`msg.ui.patch`** overrides fields (e.g. `rows`, `columns`); binding fields
  (`rows`) must be passed as a binding object.
- **Component-state ops** (`msg.ui.component.op`): `show` / `hide`.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

One output port per enabled event:

| Event | When | `msg.ui` fields |
|---|---|---|
| `rowSelect` | user clicks a row | `event: "rowSelect"`, `params: { rowId, row }` |

`rowId` is the row's `id` if present, else the array index as a string. `row` is
the full row object (the runtime enriches `params.row` read-only from the current
render). Without any enabled event the table has no output port.

> `selectAction` (deprecated but still effective) is the older direct
> action-on-click reference; new flows use `events: [rowSelect]`.

## Examples

### 1. A static table with a row-select event

Three columns over a static array of rows; `rowSelect` is enabled and wired to a
debug node, so clicking a row logs `{ rowId, row }`.

Flow file: [`examples/guide/ui-table.json`](../../../examples/guide/ui-table.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-table.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideTable/` — the table shows three
   rows; click one and watch the `rowSelect` payload appear in the Node-RED debug
   sidebar.

## Related

- [Displaying data](../guides/displaying-data.md) — the query loop, tables, lists
- [Actions & Events](../guides/actions-events.md) — wiring `rowSelect`
- Related display nodes: `ui-list`, `ui-repeat`, `ui-text`
- Contract doc (internal, German): `docs/nodes/display/ui-table.md`
