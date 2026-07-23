# Actions & Events

How user interactions reach your flow, how your flow drives the UI — and
**the two ways** of connecting them: wire vs. reference.

> Deutsch: [../de/guides/actions-events.md](../de/guides/actions-events.md)

## Goal

Wire a button's click event to UI behaviour (hide/show a card), understand
the direction rule (events up, actions down), and know when to use a wire
and when a reference.

## Prerequisites

- [Getting started](../getting-started.md) and
  [Bindings & State](bindings-state.md).

## The direction rule

- **Events flow client → server.** They describe *what the user did* —
  never what should happen next. Every interactive node has an output port
  and emits a `msg.ui` event message there (click, change, submit,
  rowSelect, route onEnter/onLeave, dialog onOpen/onClose, …).
- **Actions flow server → client.** They describe *what the UI should do* —
  navigate, `open`/`close` (dialog, accordion section, …), `show`/`hide`,
  `enable`/`disable`, `focus`, `reset`. Actions change interaction state
  only, **never data** (data goes through stores/queries).

There is **no automatic link** between an event and a reaction. The flow in
between is yours: a click can call an API, write a store, and trigger an
action — each explicitly wired. That keeps all logic visible in the flow.

An event message looks like this (wire a `debug` node set to "complete msg"
behind any component to inspect it):

```json
{
  "ui": {
    "appId": "actionsApp",
    "clientId": "client-abc123",
    "event": "click",
    "sourceId": "gaeHideButton"
  }
}
```

`clientId` identifies the browser tab that triggered the event — forward
`msg.ui.clientId` when a reaction should target only that client.

## The two ways: wire vs. reference

Everything that *targets another node* — a `ui-action` addressing its
target component, a `ui-store-action` mutating a store, a
`ui-query-action` refreshing a query — offers the same choice:

### 1. Wire (primary, recommended)

The target is connected to the node's **output port**. For `ui-action`:
wire its output to the target component (`ui-action (hide) → ui-container`)
— the wire *is* the address, and the wired target executes the command and
pushes it to the browser. For `ui-store-action`/`ui-query-action` in
**wire** mode: the node emits the ready-made command envelope
(`msg.ui.store` / `msg.ui.query`) on its output, and you wire it onwards to
the store/query that applies it.

*Why it is primary:* the flow stays visually explicit — you can read the
behaviour off the canvas, there are no hidden string references, and it is
the Node-RED-idiomatic way.

### 2. Reference (secondary, "wireless")

The target is selected by **picker** and stored in the node's
configuration:

- `ui-action` can select one or more target nodes directly on the canvas
  ("pick on canvas") instead of wiring them; on input it delivers the
  action to each picked target exactly as a wire would.
- `ui-store-action` / `ui-query-action` in **reference** mode apply the
  operation **directly server-side** on the referenced store/query — no
  wire to the store/query at all. The bound views still update live.

*When to prefer it:* when wires would clutter the canvas (many targets,
crossing flows), or when the action sits far from its target. The
behaviour is identical — but the connection is no longer visible on the
canvas, so use it deliberately.

A third, dynamic variant exists for run-time targets: a message can carry
`msg.ui.action.target = "<node-id>"` to override the target — useful when
the target comes from event data.

## Steps

1. Create an app with a `ui-container` card (a `ui-text` inside) and two
   buttons "Hide card" and "Show card" in the app content.
2. Add two `ui-action` nodes with action types `hide` and `show`. Wire:
   each button's output → its action's input, and each action's output →
   the **container** node. Deploy: the buttons now hide and show the card —
   the wire to the container is the target address (way 1).
3. Add a `ui-store` (`clicks`, initial `{"last":"(no click yet)"}`) and a
   `ui-text` bound to it (sub-path `last`).
4. Add a `ui-store-action` in **reference** mode (store picked by
   reference, op `set`, path `last`) behind a small `function` that puts a
   description of the click into `msg.payload`. Wire both buttons into it.
   Deploy: every click also updates the "last click" text — **without any
   wire to the store** (way 2).
5. Watch the direction rule at work: button → event → flow → action/store —
   and the UI updates over the live stream.

## Example flow

The finished result of the steps:
[`examples/guide/actions-events.json`](../../../examples/guide/actions-events.json)

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/actions-events.json` (or paste its JSON)
   → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/actionsApp/` — hide/show the
   card and watch the last-click text update.

## Where next

- [Navigation & Dialogs](navigation-dialogs.md) — the `navigate` action and
  its three modes, dialogs with `open`/`close`.
- [Displaying data](displaying-data.md) — the query refresh loop driven by
  events.
