# ui-store

A named slice of client state — the one declarative path for changing your
app's own data.

> Deutsch: [de/nodes/ui-store.md](../de/nodes/ui-store.md)

## Purpose

`ui-store` declares a **named state slice** in the app's client state and is the
**only declarative path for business state changes**. A store can hold
arbitrarily nested values; single fields are addressed by relative paths.
Writing happens through store operations; reading through `state` / `store`
bindings. Use a store for values the user or a form owns (draft, selection,
toggle); use [`ui-query`](ui-query.md) for server-loaded, read-only data.

## When to use

- Hold your own mutable state: a form draft, a selection, a toggle, a counter.
- Let input controls write into it (bidirectional) and views read from it.
- Not for server-loaded, read-only data with a loading state — that is
  [`ui-query`](ui-query.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and pickers. | free text | `Store N` |
| **App** | The parent `ui-app` — the routing context for all store messages. Required. | app reference | — |
| **State Path** (`statePath`) | The slice name in client state. A single identifier (`[A-Za-z0-9_]`, no dots/slashes) — a slice name, not a path (e.g. `draft`, `customers`). Unique within the app. Required. | identifier | — |
| **Initial Value JSON** (`initialValue`) | The slice's starting value, set when client state is built and the target of the `reset` operation. | JSON | empty |
| **Persist** (`persist`) | Whether the slice is persisted client-side (`localStorage`) — offline resilience and resync on reconnect. | checkbox | `false` |
| **Scope** (`scope`) | Guards the store's intended write target. `Any` = no check; `Broadcast Only` = rejects messages carrying a `clientId`; `Client Only` = rejects broadcast messages. A violation is a `server.store.scope-violation` error. | `Any` / `Broadcast Only` / `Client Only` | `Any` |

## Inputs

Written through the input port with a `msg.ui.store` message whose `id` matches
this node:

| `op` | Effect | Requires |
|---|---|---|
| `set` | set a value at a relative path | `path`, `value` |
| `patch` | React-friendly merge into an object value | `path`, `value` |
| `delete` | remove the value at a relative path | `path` |
| `replace` | replace the whole slice | `value` |
| `reset` | reset the slice to `initialValue` | — |

`msg.ui.clientId` set → update only that client (else broadcast to the app's
clients). A `msg.ui.store` whose `id` does not match is **passed through
unchanged**. Incomplete operations and scope violations are reported as
structured errors and forwarded to a wired `catch` node.

## Outputs / Events

When the store changes (from Node-RED or the client), the output port emits a
change notification:

```
msg.ui.store = { id, event: "changed", op, path, fullPath,
                 value, previousValue, origin: "node-red" | "client" }
```

`fullPath` is the absolute client-state path (`statePath` + relative `path`);
`origin` distinguishes flow-driven from client-driven changes.

## Examples

### 1. A store read by a text view

A store with an initial greeting; a `ui-text` bound to it via a `state` binding
shows the value on the home page.

Flow file: [`examples/guide/ui-store.json`](../../../examples/guide/ui-store.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-store.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideStore/` — you see
   "Hello from the store".

## Related

- [Bindings & State](../guides/bindings-state.md) — binding kinds, stores, operations
- [`ui-store-read`](ui-store-read.md) / [`ui-store-action`](ui-store-action.md) — read / mutate a store
- [`ui-query`](ui-query.md) — server-loaded data (the distinction)
- Contract doc (internal, German): `docs/nodes/state/ui-store.md`
