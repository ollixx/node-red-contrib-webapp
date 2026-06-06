# ADR 0007: action message contract + per-node interaction handlers

- Status: accepted
- Date: 2026-06-06
- Builds on: [ADR 0003](0003-live-node-red-app-no-preview.md) (the flow is the
  only place for logic; actions change interaction state only) and
  [ADR 0005](0005-ui-action-interaction-vocabulary.md) (the canonical verb set +
  the client-side interaction overlay).

## Context

ADR 0005 fixed the verbs but left the *delivery model* incoherent, and it
diverged from what `docs/nodes/concepts/actions.md` already promised:

1. **The doc promises wiring; the code does not read wiring.** `actions.md` §1
   states the primary addressing is "wire the `ui-action` output port to the
   target node; the runtime reads the wiring and forwards the action to that
   component." The implementation does **not** read flow topology. Instead
   `actionInputHandler` ([nodes/webapp.js](../../nodes/webapp.js)) builds a
   command from the node's own `target` **config field** and pushes it centrally
   via `pushActionCommandToClients`; the output port merely passes `msg` through
   unchanged. The wire is decorative.

2. **Two conflicting "target" notions.** The editor `target` text field maps to
   `command.target` (a *rendered component id*, sent to the browser over SSE),
   while `msg.ui.action.targetId` maps to a *flow node id* delivered with
   `targetNode.send()`. Both are called "target"; one is a DOM component, the
   other a flow node. The editor exposes the first as free-text copy-paste.

3. **`send()` injects into the wrong port.** The dynamic-target path calls
   `targetNode.send(msg)`, which emits from the *target's output*, not into its
   *input*. To inject a message into a node you must call `targetNode.receive()`.

4. **Only `ui-action` can act.** Because the SSE push lives centrally in
   `ui-action`, no other node can trigger an interaction. A plain `inject` or
   `trigger` carrying `{ ui: { action: { type: "navigate", to: "/" } } }` cannot
   make the app jump home — which is exactly the kind of visible, flow-driven
   composition Node-RED is built for.

The owner's decision: make the model **uniform and flow-visible**. Logic lives in
flows; the wire that connects a trigger to a target *is* the addressing. Any node
that emits the right message triggers the interaction — `ui-action` is just a
convenient, typed emitter, not a privileged one.

## Decision

### 1. The action message is a public contract

The interaction command travels in `msg.ui.action`, validated by a new
`actionMessageSchema` in `packages/schema`:

```
msg.ui = {
  clientId?: string,              // P15 per-client targeting; absent = broadcast
  action: {
    type: <verb>,                 // ADR 0005 verb set
    to?: string,                  // navigate destination (route path)
    part?: string,                // disclosure / single-active sub-id
    target?: string,              // OPTIONAL explicit component id; see §3
  }
}
```

The schema validates **only** `msg.ui.action`. Unrelated `msg.*` fields (and
unrelated `msg.ui.*` fields) are **passed through untouched** — a node receiving
a real-world message (with `payload`, `topic`, `_msgid`, …) enriches it, it does
not replace it. This is the idiomatic "modify the incoming message" model: the
emitter sets/merges `msg.ui.action`, everything else rides along.

Because this is a plain message contract, **any node can produce it** — `inject`,
`trigger`, `function`, an HTTP response, or `ui-action`. `ui-action` is the
ergonomic, schema-backed emitter; it holds no special runtime privilege.

### 2. The SSE push moves into the target node (per-node interaction handlers)

The single biggest change: the SSE push leaves `ui-action` and moves into **each
target node's input handler**. This generalises the pattern `ui-toast` already
uses (`toastInputHandler`: input → push own SSE command → pass `msg` through).

- Each interaction-capable node owns a set of verbs and registers a shared
  `interactionInputHandler(ownedVerbs)`:
  - `ui-dialog` / disclosure elements → `open` / `close`
  - presence-capable view nodes (`ui-button`, `ui-input`, `ui-text`,
    `ui-table`, `ui-container`, …) → `show` / `hide`
  - interactive controls (`ui-button`, `ui-input`) → `enable` / `disable`
  - input controls (`ui-input`) → `focus` / `reset`
  - single-active containers (tabs, stepper, menu) → `select`
  - `ui-app` and `ui-route` → `navigate` (app/router-global) and `reset`
    (app-scoped) — see §4
- On input the handler resolves the command's `target` to **its own node id**
  (the wire/selection *is* the addressing), applies `part` / `to` / overrides
  from `msg.ui.action`, pushes the command to the relevant client(s) via the
  existing SSE channel, and then **passes `msg` through** its output port.
- A verb the node does not own → **pass-through** (default), so a chain of wired
  targets each handle the verbs they own and ignore the rest. Explicit "swallow"
  is an opt-in, not the default — silent drops are hard to follow (ADR 0006
  spirit).

This removes the confusing `target` *config field* from the common case: wiring
`ui-action → ui-dialog` means the dialog's handler pushes
`{ type: "open", target: <dialog id> }` automatically. `target` in the message
remains available as an explicit override for advanced/dynamic cases.

### 3. `ui-action` becomes a typed emitter; addressing is the wire

`ui-action` on input builds a schema-valid `msg.ui.action` from its configured
`actionType` / `to` / `part` (with `msg.ui.action` overrides winning, per ADR
0005) and **sends it out its output port**. It no longer pushes SSE itself.

Two ways to address the target, both producing the identical delivery:

- **Wiring (primary, visible).** Wire the output port to the target node(s). The
  target's input handler does the push. This is `actions.md` §1, now actually
  implemented as written.
- **Node selection (optional, "wireless").** For users who do not want wires,
  `ui-action` offers a **multi-select node picker** built on Node-RED's
  `RED.view.selectNodes()` (the same canvas-pick API the core `catch` / `status`
  / `complete` nodes use for scope), filtered to interaction-capable webapp
  nodes. The picked ids are stored on the node; on input it delivers the message
  to each via `targetNode.receive(msg)` — the **same input path** a wire uses, so
  behaviour is identical. (`receive()`, **not** `send()` — fixing the §Context-3
  bug.)

The picker is explicitly the secondary, implicit option: Node-RED thrives on
visible flows; hidden id references are harder to follow, but allowed.

### 4. App-global verbs route to `ui-app` / `ui-route`

For uniformity there is no special-cased central push for `navigate` / `reset`.
`ui-app` and `ui-route` gain an input handler (and `ui-route` gains `inputs: 1`,
it currently has none). You wire — or pick — `ui-app` / `ui-route` as the target,
exactly like any other node. A direct consequence (§1): a bare `inject` wired to
`ui-app` carrying `{ ui: { action: { type: "navigate", to: "/" } } }` jumps the
client home, with no `ui-action` involved.

## Consequences

- The delivery model matches `actions.md` §1 as written; the doc/impl drift
  (ADR 0005 stop-condition-5 class) is resolved.
- Interaction triggering is democratised: any node emitting the contract works;
  `ui-action` is convenience, not gatekeeper. This is the intended Node-RED
  flexibility.
- The `target` config field's copy-paste UX is replaced by canvas node selection
  (or wiring). `target` survives only as an optional message-level override.
- The SSE push is distributed into per-node handlers via one shared factory;
  `pushActionCommandToClients` stays as the transport, now called by the target
  node rather than by `ui-action`.
- Backward compatibility: existing flows that wired `ui-action → target` keep
  working (the wire now actually carries the action). Flows relying on
  `ui-action`'s configured `target` field + an *unwired* output need migration —
  handled in the implementing phase with a documented compat path.
- `msg.ui.action.targetId` (ADR 0005 / actions.md §2) is unified with `target`:
  both name a node id; the override path uses `receive()`.
