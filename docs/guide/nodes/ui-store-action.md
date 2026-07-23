# ui-store-action

Mutates a `ui-store` by a typed operation — pick the store and the op instead of
hand-building `msg.ui.store`.

> Deutsch: [de/nodes/ui-store-action.md](../de/nodes/ui-store-action.md)

## Purpose

`ui-store-action` is a typed, reference-based **mutation node** for a
[`ui-store`](ui-store.md): it references a store by id and, on every input,
triggers a write op (`set` / `patch` / `delete` / `replace` / `reset`) — instead
of building `msg.ui.store = {…}` by hand. It has two modes:
**reference** applies the op directly server-side (a live re-render, no wire to
the store); **wire** emits the command envelope for you to wire. This is the
reference-vs-wire choice — see [Actions & Events](../guides/actions-events.md).

## When to use

- Change a store from the flow with a clear, typed op.
- Use **reference** mode for the common case (apply directly, no wire).
- Use **wire** mode when you want the envelope in the flow (to a store or a
  dispatcher). To read instead of write, use [`ui-store-read`](ui-store-read.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor. | free text | `Store Action N` |
| **App** | The owning `ui-app`. Required. | app reference | — |
| **Store** | The `ui-store` to mutate, from the store picker. Required. | store reference | — |
| **Operation** (`op`) | The write op. `set` / `patch` / `replace` take their value from `msg.payload`; `delete` / `reset` take none. | `set` / `patch` / `delete` / `replace` / `reset` | `set` |
| **Path** (`path`) | Sub-path within the slice (one level, relative to `statePath`). Empty = the whole slice. Overridable at runtime. | sub-path | empty |
| **Mode** (`mode`) | `reference` applies the op directly server-side and pushes a snapshot; `wire` emits the envelope without mutating. | `reference` / `wire` | `reference` |

## Op semantics

| `op` | Effect | Value source |
|---|---|---|
| `set` | writes the value at `path` (empty = whole slice) | `msg.payload` |
| `patch` | deep-merge at `path` | `msg.payload` |
| `delete` | deletes the subtree at `path` | — |
| `replace` | replaces the **whole** slice | `msg.payload` |
| `reset` | resets the slice to the store's `initialValue` | — (ignores the value) |

Path precedence: `msg.ui.store.path` › `msg.path` › config `path` › whole slice.

## Inputs

Every input message runs the op. **Value:** `set`/`patch`/`replace` need a value
in `msg.payload` (missing → `server.store.invalid-operation`). **Per-client:**
`msg.ui.clientId` mutates that client's state (else broadcast); the store's scope
rule applies (`client-only` without / `broadcast-only` with a `clientId` →
`server.store.scope-violation`).

**Error codes (reference mode):**

| Code | Cause |
|---|---|
| `server.store.action-missing-store` | referenced store not in the registry |
| `server.store.scope-violation` | scope rule violated |
| `server.store.invalid-operation` | `set`/`patch`/`replace` with no value |
| `server.store.no-active-app` | no active `ui-app` registered |
| `server.store.operation-failed` | `applyStoreOperation` threw |

## Outputs / Events

```
// reference mode (after mutating):
msg.ui.store = { id, event: "changed", op, path, fullPath, value, previousValue, origin, clientId }

// wire mode (command, no mutation):
msg.ui.store = { id, op, path, value }
```

## Examples

### 1. Set a store value from the flow (reference mode)

An inject with a payload triggers a `ui-store-action` (`set`) that writes the
store directly; a `ui-text` bound to the store shows the new value live.

Flow file: [`examples/guide/ui-store-action.json`](../../../examples/guide/ui-store-action.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-store-action.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideStoreAction/` — it shows
   "idle"; click the inject and the text becomes "active".

## Related

- [`ui-store`](ui-store.md) — the store being mutated
- [`ui-store-read`](ui-store-read.md) — read a store
- [Actions & Events](../guides/actions-events.md) — wire vs. reference
- Contract doc (internal, German): `docs/nodes/state/ui-store-action.md`
