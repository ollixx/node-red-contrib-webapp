# ui-store-read

Reads a `ui-store`'s current value on demand — a non-mutating getter for the
backend flow.

> Deutsch: [de/nodes/ui-store-read.md](../de/nodes/ui-store-read.md)

## Purpose

`ui-store-read` reads a [`ui-store`](ui-store.md) **on demand**: it references a
store by id and, on every input message, emits the store's current value (whole
slice or a sub-path). It is **non-mutating** and per-client — use it for backend
access (persist / export / sync) without hand-building a read or funnelling
everything through the store node. This is the **reference** style: pick the
store instead of wiring to it (see [Actions & Events](../guides/actions-events.md)
for wire vs. reference).

## When to use

- Grab a store's current value inside the flow (to persist it, export it, sync it).
- Read one field with a sub-path; leave the path empty to read the whole slice.
- Not to change state — that is [`ui-store-action`](ui-store-action.md); not to
  display state — that is a `state` / `store` binding on a view.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor. | free text | `Store Read N` |
| **App** | The owning `ui-app` (app-bound reference node). Required. | app reference | — |
| **Store** | The `ui-store` to read, chosen from the store picker (which also lists implicit query params targets). Required. | store reference | — |
| **Default Path** (`path`) | Default sub-path within the slice (one level, relative to `statePath`). Empty = the whole slice. Overridable at runtime. | sub-path | empty |

## Inputs

Every input message triggers a read. **Path precedence:** `msg.ui.store.path` ›
`msg.path` › config **Default Path** › whole slice. **Per-client:** with
`msg.ui.clientId` it reads that client's state (else broadcast). The store's
scope rule applies (`client-only` without a `clientId`, or `broadcast-only` with
one, is a `server.store.scope-violation`) — on a violation the read is a no-op
(no emission). Errors: `server.store.read-missing-store`,
`server.store.scope-violation`, `server.store.no-active-app` — each a structured
`done(error)` with no emission.

## Outputs / Events

On a successful read:

```
msg.payload   = <value>   // whole slice or sub-value
msg.ui.store  = { id, event: "read", path, fullPath, value, clientId }
```

## Examples

### 1. Read a store on a trigger

An inject triggers a `ui-store-read` of a seeded store; the read value appears
in a debug node. The app page shows the store value via a `state` binding.

Flow file: [`examples/guide/ui-store-read.json`](../../../examples/guide/ui-store-read.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-store-read.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideStoreRead/`, then click the
   inject and watch the read value in the debug sidebar.

## Related

- [`ui-store`](ui-store.md) — the store being read
- [`ui-store-action`](ui-store-action.md) — mutate a store (reference/wire)
- [Actions & Events](../guides/actions-events.md) — wire vs. reference
- Contract doc (internal, German): `docs/nodes/state/ui-store-read.md`
