# ui-pagination

Page navigation controls (prev/next, page number) for a paginated data set.

> Deutsch: [de/nodes/ui-pagination.md](../de/nodes/ui-pagination.md)

## Purpose

`ui-pagination` renders **page navigation controls** — prev/next buttons and a
page label — for paginated data. It shows the current page and total from bindable
fields and emits a `pageChange` event when the user navigates. It typically works
with [`ui-query`](ui-query.md) and [`ui-store`](ui-store.md): the store holds the
current page, `ui-query` loads the matching data, and `ui-pagination` is the
control for it. The current page is a **two-way binding** (`currentPage`).

## When to use

- Add page navigation under a [`ui-table`](ui-table.md) or [`ui-list`](ui-list.md).
- Drive a reactive paging loop with a params store and a `ui-query`.
- For infinite/streaming lists (no discrete pages) this node does not apply.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Pagination N` |
| **Parent Slot** (`mount`) | The slot this mounts into. Required. | mount path | — |
| **Current Page** (`currentPage`) | **Two-way** binding on the current page number (1-based). Reads the live page; the page change emits `pageChange` for the write-back loop. Required. | `state`, `store`, `query`, `routeParam`, `literal`, `reactive`, `msg`, `flow`, `global`, `jsonata`, `env` (default type `number`) | — |
| **Total** (`total`) | **Read-only** binding on the total page count. Typically from a `ui-query` result (e.g. `query:<path>.totalCount`). Required. | same kinds as Current Page | — |
| **Page Size** (`pageSize`) | Items per page (config number). | number | — |
| **Info line** (`showInfo`) | `true` — renders a "Page X of Y" info line below the controls (class `.webapp-pagination-info`). The compact "X / Y" label between the buttons is separate and always shown. | checkbox | off |
| **Events** (`events`) | Enables the `pageChange` output port. | `pageChange` | none |
| **Visible** / **Disabled** / **Color** | Base fields. | — | — |

`Size` is N/A (no size steps). A vestigial `totalItems` binding and a vestigial
`variant` enum (`numbered`/`simple`) were **removed** (P252) — the page count comes
solely from `total`, and neither field ever rendered distinctly. Legacy flows
carrying them deploy unchanged.

## Inputs

`ui-pagination` **has an input port**:

- **`msg.payload`** — sets the current page directly (integer ≥ 1); the
  `currentPage` binding leads again on the next resolution.
- **`msg.ui.patch`** — overrides fields (e.g. `showInfo`).
- **`msg.ui.component.op`** (`show`, `hide`) — toggles the controls.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

When `pageChange` is enabled, `ui-pagination` has one output port:

| Event | When | `msg.ui` fields |
|---|---|---|
| `pageChange` | user changes the page | `event: "pageChange"`, `params.page` (the new 1-based page), `clientId`, `sourceId`, `appId` |

**Two-way write-back:** the runtime does not write the store itself. Wire
`pageChange` → `ui-store-action` (`set`) on the store the `currentPage` binding
reads; then `ui-query` (reading the same store) reloads the matching data. The
displayed page only changes once the store feeds `currentPage` back.

## Examples

### 1. A pager with the info line and a store write-back

Prev/next controls over 5 pages, with the "Page X of Y" info line. `currentPage`
reads a store value; `pageChange` writes the new page back — the two-way loop.

Flow file: [`examples/guide/ui-pagination.json`](../../../examples/guide/ui-pagination.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-pagination.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guidePagination/` — the pager renders
   with an info line; clicking prev/next emits `pageChange` and updates the store.

## Related

- [`ui-query`](ui-query.md) — loading data with page/pageSize parameters
- [`ui-table`](ui-table.md) / [`ui-list`](ui-list.md) — the paged content
- [Displaying data](../guides/displaying-data.md) — the query loop and pagination
- Contract doc (internal, German): `docs/nodes/navigation/ui-pagination.md`
