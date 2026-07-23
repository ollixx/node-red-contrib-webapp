# Displaying data

Server data on the page: queries and their fetch loop, tables, lists,
repeated templates, and pagination.

> Deutsch: [../de/guides/displaying-data.md](../de/guides/displaying-data.md)

## Goal

Load server data through a `ui-query` into a bound `ui-table`, repeat a
template per item with `ui-repeat`, and know the paging pattern.

## Prerequisites

- [Bindings & State](bindings-state.md) — especially the store-vs-query
  rule.

## Queries: loaded data with a lifecycle

A `ui-query` declares *where* loaded data lives (its **Query Path**, e.g.
`fruits.list`) and tracks its load state — it does **not** load anything
itself. The data source is whatever you wire behind it (a database node, an
HTTP request, a `function`). That is deliberate: a freshly deployed query
is empty until the loop below runs — "empty at first" is normal, not a bug.

**The query loop (refresh → fetch → data back):**

1. A **trigger** reaches the query's input port — typically a route's
   `onEnter`, a button click, or a refresh from a `ui-query-action`.
2. The query passes the trigger through its **output port** and marks
   itself `loading`.
3. Behind the output sits your **data source**. It loads the rows and
   sends them **back to the query's input** as
   `msg.ui.query = { queryPath: "<path>", data: <rows> }` (or
   `error: "<message>"` on failure).
4. The query stores the data, and every `query:<path>` binding updates
   live. The data return is terminal — it is not re-emitted (no loop).

```js
// the function node behind the query's output:
msg.ui = { query: { queryPath: "fruits.list", data: rows } };
return msg; // wire back to the query's input
```

Reading a query in a binding: `query:<path>` gives the **data**;
`query:<path>.loading`, `.error`, `.status`, `.updatedAt`, `.totalCount`
give the lifecycle — bind a spinner's visibility to `.loading`, an error
text to `.error`.

## Tables and lists

- **`ui-table`** — bind **Rows** to the query (`query:fruits.list`) and
  declare the **Columns** (the field names of a row object). The table
  emits `rowSelect` / `rowAction` events with the full row in the params —
  the standard hook for "open the detail page".
- **`ui-list`** — same idea for list-shaped display; bind **Items** and
  map the item fields to the list's label/description slots.

## Repeat: your own template per item

Where table/list layouts are not enough, `ui-repeat` clones an arbitrary
template once per array item:

- Bind its **Items** to any array source (store or query).
- Set the **Key Field** (a stable id per item) so re-renders keep item
  identity.
- Mount any components into the repeat's template slot. Inside the
  template two extra binding kinds appear: **item** (a field of the
  current element, e.g. `name`) and **index** (the element's position).
  This is the item-field mapping: `item.name`, `item.role`, … per clone.

The repeat itself adds no styling or layout — nest a `ui-container` in
the template for card-like items.

## Pagination pattern

For long lists, page on the server and let the query drive the loop:

1. Every query has an implicit per-client **params store** (page, page
   size, search, …), addressable like a store via the query node.
2. A `ui-pagination` (or any button) writes `page` into those params —
   e.g. with a `ui-store-action` targeting the query.
3. A params change automatically fires a refresh on the query's output
   port with the current params attached (`msg.ui.query.params`).
4. Your fetch reads `msg.ui.query.params.page`, loads that page, and
   returns `data` plus `totalCount`. Bind the pagination's total to
   `query:<path>.totalCount`.

## Steps

1. Create an app with a `ui-query` (query path `fruits.list`).
2. Wire a "Load fruits" `ui-button` into the query's input, and a
   `function` node behind the query's output that returns three rows to
   the query's input (the code above). In a real app this function is
   your DB/HTTP lookup.
3. Mount a `ui-table` with columns `name,color,stock` and bind its rows
   to `query:fruits.list`. Deploy: the table is empty; clicking **Load
   fruits** fills it.
4. Add a `ui-store` holding an array of people and a `ui-repeat` bound to
   it (key field `name`). Mount two `ui-text` nodes into the repeat
   template with **item** bindings `name` and `role`. Deploy: one
   name/role pair renders per array element.

## Example flow

The finished result of the steps:
[`examples/guide/displaying-data.json`](../../../examples/guide/displaying-data.json)

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/displaying-data.json` (or paste its
   JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/dataApp/` — click **Load
   fruits** and watch the table fill; below it the repeated people
   template.

## Where next

- [Forms](forms.md) — editing the data you display.
- [Actions & Events](actions-events.md) — reacting to row selection.
