# ui-query

A named, loaded data source for the UI — read-only, with a loading state. It
loads nothing itself: you wire the fetch.

> Deutsch: [de/nodes/ui-query.md](../de/nodes/ui-query.md)

## Purpose

`ui-query` declares a **named, loaded data source**. It describes *where* the
data lives in client state (`queryPath`) and *what loading state* it is in — not
*how* it is fetched. You wire the actual fetch (DB, HTTP, …) behind its input
port and send the result back to the node. View nodes bind to the loaded data
via `query` bindings. It is **read-only** in the UI — for your own mutable state
use [`ui-store`](ui-store.md).

## When to use

- Show server-loaded, read-only data (a list, a record, a search result).
- Drive a loading spinner / error message from the query's `.loading` / `.error`.
- Not for user-owned mutable state (draft, selection) — that is
  [`ui-store`](ui-store.md).

> **"Empty is normal."** A freshly deployed query is empty until you wire the
> fetch — the node loads nothing on its own.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and pickers. | free text | `Query N` |
| **App** | The parent `ui-app` — routing context for query data and load events. Required. | app reference | — |
| **Query Path** (`queryPath`) | Where the data is stored in client state; bindings reference it (`customers.list` → `query:customers.list`). Unique within the app. Required. | path | — |
| **Params Store** (`params`) | Optional reference to a shared `ui-store` holding the query params (page, sort, search). Empty = the query uses its **implicit per-query params store**. Either way, a params change fires an out-port refresh. | store reference | empty (implicit) |
| **Debounce (ms)** (`debounceMs`) | Delay for batching fast params changes (search typing) before the out-port refresh. Empty / `0` = immediate. | number | `0` |
| **Refresh Action** (`refreshAction`) | Optional `ui-action` of the same app that manually triggers a refresh (extra trigger beside the params store). | action reference | empty |

## Inputs

The input port accepts a `msg.ui.query` whose `queryPath` matches this node:

```
msg.ui.query.queryPath = "customers.list"   ← must match
msg.ui.query.data      = [...]              ← new data (terminal — absorbed, not re-emitted)
msg.ui.query.error     = "..."              ← load error (terminal)
msg.ui.query.refresh   = true               ← refresh signal (passes to the out-port)
msg.ui.query.totalCount / .pageCount        ← paging, optional beside data
msg.ui.clientId        = <targeted push>
```

A `data` / `error` message is **terminal**: it is stored and pushed to clients,
never re-emitted on the out-port (loop guard). A `refresh` / `loading` message
sets the load state **and** passes through the out-port. Unknown / foreign
messages pass through unchanged, so the node can sit transparently between the
trigger and the fetch.

## Outputs / Events

The out-port carries **only triggers** toward the fetch (a `refresh`, an
`onEnter` trigger, or a reactive params refresh). Behind it you wire the real
data source and send the result back to the input port as `msg.ui.query.data`.
`data` / `error` end at the input (they do not reach the out-port).

**Read convention:** `query:<queryPath>` is the **data**; `.loading` / `.error`
/ `.updatedAt` / `.status` / `.totalCount` / `.pageCount` read the load state.

## Examples

### 1. A wired fetch fills a query

An inject triggers the query; a `function` returns a value as `msg.ui.query.data`;
a `ui-text` bound to `query:message` shows it. A static line keeps the page
non-empty before the fetch returns.

Flow file: [`examples/guide/ui-query.json`](../../../examples/guide/ui-query.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-query.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideQuery/` — the query line shows
   "Loaded via ui-query" after the wired fetch returns.

## Related

- [Displaying data](../guides/displaying-data.md) — the query loop, tables, lists
- [`ui-query-action`](ui-query-action.md) — refresh / replace a query (reference/wire)
- [`ui-store`](ui-store.md) — your own mutable state (the distinction)
- Contract doc (internal, German): `docs/nodes/state/ui-query.md`
