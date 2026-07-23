# ui-query-action

Triggers a `ui-query` refresh or writes its data — the typed way, without
hand-building `msg.ui.query`.

> Deutsch: [de/nodes/ui-query-action.md](../de/nodes/ui-query-action.md)

## Purpose

`ui-query-action` is a typed, reference-based node for a
[`ui-query`](ui-query.md): it references a query by id and its **action** picks
the direction — instead of building `msg.ui.query = {…}` by hand:

- **`refresh`** (data-out): triggers the query's refresh on every input.
- **`replace`** (data-in): writes incoming `msg.payload` as the query's data.

Together they form the typed loop
`refresh → fetch → replace`. Two modes: **reference** applies directly
server-side; **wire** emits the envelope (see [Actions & Events](../guides/actions-events.md)).

## When to use

- Kick off a query's fetch from the flow (`refresh`).
- Write a fetch result straight into a query (`replace`) — the typed form of
  `msg.ui.query = { queryPath, data }`.
- Use **wire** mode when you want the envelope in the flow instead of applying it.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor. | free text | `Query Action N` |
| **App** | The owning `ui-app`. Required. | app reference | — |
| **Query** | The `ui-query` to target, from the query picker. Required — empty is a runtime error. | query reference | — |
| **Action** (`action`) | Direction. `refresh` triggers the query (data-out); `replace` sets the query's data from `msg.payload` (data-in). | `refresh` / `replace` | `refresh` |
| **Mode** (`mode`) | `reference` applies directly server-side; `wire` emits the envelope. | `reference` / `wire` | `reference` |

## Action semantics

| Value | Direction | Effect |
|---|---|---|
| `refresh` | data-out | fires the referenced query's refresh (lifecycle → `loading`, retrieval fires) |
| `replace` | data-in | sets the query's data from `msg.payload` (status `success`, `updatedAt` set) |

## Inputs

Every input runs the action. **`refresh`** params come from
`msg.ui.query.params` › `msg.payload` (else no `params` key). **`replace`** data
comes from `msg.payload` (no payload → `data` is `[]`); optional
`totalCount`/`pageCount` are carried when present on `msg.ui.query.*`.
`msg.ui.clientId` targets one client. Error: `server.query.action-missing-query`
(query not in the registry) — a `done(error)` with no send.

## Outputs / Events

```
// refresh, reference mode: this node emits NOTHING — the referenced query fires
// at ITS out-port: msg.ui.query = { queryPath, refresh: true, params? }
// refresh, wire mode (this node): msg.ui.query = { queryPath, refresh: true, params? }

// replace, reference mode: this node emits NOTHING — ui.queries.<queryPath>.data is set (SSE re-render)
// replace, wire mode (this node): msg.ui.query = { queryPath, data, totalCount?, pageCount? }
```

## Examples

### 1. Write query data with `replace` (reference mode)

An inject payload is written into a query via `replace`; a `ui-text` bound to the
query shows it live.

Flow file: [`examples/guide/ui-query-action.json`](../../../examples/guide/ui-query-action.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-query-action.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideQueryAction/` and click the
   inject — the query line shows "Replaced via ui-query-action".

## Related

- [`ui-query`](ui-query.md) — the query being triggered / filled
- [Displaying data](../guides/displaying-data.md) — the query loop
- [Actions & Events](../guides/actions-events.md) — wire vs. reference
- Contract doc (internal, German): `docs/nodes/state/ui-query-action.md`
