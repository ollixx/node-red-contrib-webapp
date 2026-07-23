# Bindings & State

How component fields get live values: the binding kinds, stores as the
mutable client state, and the typical patterns.

> Deutsch: [../de/guides/bindings-state.md](../de/guides/bindings-state.md)

## Goal

Bind a text to a store slice, change the store from the flow, and know which
binding kind to reach for in which situation.

## Prerequisites

- A running first app — [Getting started](../getting-started.md).
- The structure rule from [Layout & Slots](layout-slots.md).

## What is a binding?

Almost every value field in the editor (a text's **Value**, a table's
**Rows**, an image's **Src**, but also **Visible**, **Disabled**, **Color**)
is a **typedInput**: next to the field you pick *where the value comes
from*. A plain typed value is a **literal**; every other kind connects the
field to a live source that updates the page automatically.

## The binding kinds, user-oriented

| Kind | Reads from | Typical use |
|---|---|---|
| **literal** (string/number/boolean/JSON/timestamp) | the configured value itself | fixed labels, defaults |
| **Store** | a `ui-store` of the same app (picked by node, optional sub-path) | form drafts, selections, toggles — anything the user owns |
| **Query** | a `ui-query`'s loaded data (`query:<path>`), or its load state via `.loading` / `.error` / `.status` / `.updatedAt` | server data: lists, detail records — see [Displaying data](displaying-data.md) |
| **Route-Param** | a parameter of the active route (e.g. `id` from `/customers/:id`) | detail pages |
| **User** | the authenticated user (`id` / `name` / `email` / `groups`) — see [Auth](auth.md) | "signed in as…", group-dependent UI |
| **Reactive** | a client-side expression combining `store(…)`, `query(…)`, route params and `user` | computed values, conditions (`(user?.groups ?? []).includes("admins")`) |
| **msg** | a property of the next incoming Node-RED message on the node's input port | flow-driven updates; empty until a message arrives |
| **JSONata** | a JSONata expression evaluated against the incoming message | reshaping message data |
| **Flow / Global** | Node-RED flow/global context (resolved server-side, once per render) | instance-level configuration values |
| **Env** | an environment variable | deployment configuration |

Every binding can carry a **fallback** that is used while the source
resolves to nothing (for example a `user` binding without an identity
source, or a `msg` binding before the first message).

Two kinds are **scope-local** and only appear where they make sense:
**item**/**index** inside a `ui-repeat` template and **prop** inside a
component definition — see [Displaying data](displaying-data.md) and
[Theming & Components](theming-components.md).

## Stores: the mutable client state

A `ui-store` declares a named slice of the app's client state:

- **State Path** (`statePath`) — the slice's name, unique per app (e.g.
  `greeting`, `draft`). One store can hold arbitrarily nested values —
  you rarely need more than a handful of stores.
- **Initial Value** — the slice's starting value; the `reset` operation
  restores exactly this.
- **Scope** — who may write: `any` (default), `broadcast-only` (shared
  state: writes without a client id only), or `client-only` (per-client
  state: every write must carry a `msg.ui.clientId`). Violations are
  rejected with a structured error.

Components **read** a store via the Store binding (pick the store node, add
an optional sub-path like `name` for one property). Components never write
state directly — writing goes through store operations:

```js
// in a function node, wired to the ui-store's input port:
msg.ui = { store: { id: "gbsStore", op: "set", path: "name", value: "Ada" } };
return msg;
```

The operations are `set`, `patch` (object merge), `delete`, `replace`
(whole slice), and `reset`. If you prefer a typed node over building the
message by hand, `ui-store-action` does the same referencing the store by
picker — see [Actions & Events](actions-events.md) for its two modes.

When a store changes, every binding on it updates live in all connected
browsers (per-client if the operation carried a `clientId`), and the store
node emits a `changed` notification on its output port so your flow can
react (persist to a database, recompute, …).

**Store or Query?** If the user/form owns the value (draft, selection,
toggle) → store. If the server loads it and the UI only displays it →
[`ui-query`](displaying-data.md), which adds a loading lifecycle and stays
read-only in the UI.

## Steps

1. Create an app with a `ui-store` (state path `greeting`, initial value
   `{"name":"World"}`).
2. Mount a `ui-text` and bind its **Value** to the store with sub-path
   `name`. Deploy and open — you see `World`.
3. Add a `ui-button` "Greet Ada" wired to a `function` node that sends
   `msg.ui.store = { id: <store>, op: "set", path: "name", value: "Ada" }`
   into the store's input. Click it — the text flips to `Ada` live, in
   every open tab.
4. Add a "Reset" button the same way with `op: "reset"` — the text returns
   to `World`.
5. Mount another `ui-text` with a **User** binding (path `name`) and a
   fallback. Without an identity source it shows the fallback — with
   [auth](auth.md) enabled it shows the signed-in user.

## Example flow

The finished result of the steps:
[`examples/guide/bindings-state.json`](../../../examples/guide/bindings-state.json)

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/bindings-state.json` (or paste its JSON)
   → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/bindingsApp/` — click **Greet
   Ada** and **Reset** and watch the bound text update live.

## Where next

- [Forms](forms.md) — inputs that read *and write* a store with zero wiring.
- [Displaying data](displaying-data.md) — queries, tables, lists, repeat.
- [Auth](auth.md) — the `user` source in detail.
