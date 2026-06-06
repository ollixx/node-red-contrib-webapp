# ADR 0005: ui-action interaction vocabulary + client-side interaction-state overlay

- Status: accepted
- Date: 2026-06-06
- Builds on: [ADR 0003](0003-live-node-red-app-no-preview.md) (actions change
  interaction state only; the flow is the only place for logic) and the P26
  shared serializer + P31 live SSE command channel.

## Context

A button wired to a `ui-action` with `actionType: show` did nothing. The path
itself is correct — button click → output port → `ui-action` →
`pushActionCommandToClients` → SSE `command` event → client `applyCommand()` —
and the action effect rightly travels over the **SSE command channel**, not in
the wire `msg` (the wire `msg` stays the unchanged click event so the flow can
chain). But two problems blocked the verbs from working:

1. **No client-side interaction-state layer.** `applyCommand()` in
   `resources/lib/webapp-client.js` handled only `navigate` / `openDialog` /
   `closeDialog` / `hide` (the last wired to *close the dialog*). `show` /
   `enable` / `disable` / `focus` / `reset` fell into the `default` branch and
   were **no-ops**. There was nowhere to record that an element should be
   hidden/disabled such that the *next* snapshot re-render would respect it — a
   `ui-store`-driven snapshot push would wipe any ad-hoc DOM mutation.

2. **Vocabulary drift, doc vs impl (stop condition 5).** `actions.md` defined
   `show`/`hide` as **dialog** verbs (field `dialog`) and still listed the
   P29-killed `submit`/`remove`. The implementation used `openDialog`/`closeDialog`
   with `target`; `hide` was wired as "close dialog", not "hide element".

## Decision

### 1. Canonical verb set — three semantic classes

| Class | Verbs | Target | Effect |
|---|---|---|---|
| **Presence** | `show` / `hide` | any element (node id) | element is displayed / removed from layout (CSS `display`) |
| **Disclosure** | `open` / `close` | an *openable* visible element (dialog, drawer, accordion section, details, tree branch) + optional `part` sub-id | element's open-state toggles |
| **Single-active** | `select` | one of a sibling set (tab, stepper step, menu item) + `part` | confirmed in this ADR; client support is additive on top of the overlay |

plus `navigate`, `enable` / `disable`, `focus`, `reset`.

`submit` / `remove` stay **removed** (P29). `show`/`hide` (presence) are kept
**distinct** from `open`/`close` (disclosure of an already-present element). A
button can `show`/`hide` an element; it cannot `open` one.

`open` / `close` **replace** `openDialog` / `closeDialog` as the general
disclosure pair — a dialog is just the first openable element. For backward
compatibility the client still accepts `openDialog` / `closeDialog` as aliases
of `open` / `close` with no `part` (the existing E2E + customers-crud flow keep
working unchanged).

### 2. Target model

The command carries `target` (a rendered node id) plus an optional `part`
(sub-id within that element — accordion section, tree branch, tab name). The
existing `msg.ui.action.targetId` override still wins over the static wiring.
`buildActionCommand` emits `{ type, to, target, part }`.

### 3. Client-side interaction-state overlay (the core architectural answer)

The client keeps a per-node **interaction overlay**, a map
`nodeId → { hidden?, disabled? }`, plus an open-set (`open`/`close` of
non-dialog elements keyed by `target` / `target#part`), a pending focus target,
and the single dialog id (dialogs reuse the existing `dialogId`).

- `applyCommand()` mutates the overlay and then re-applies it to the live DOM.
- **Crucially, the overlay is re-applied after every snapshot render**
  (`applySnapshot`). So a `show`/`hide`/`disable` survives a subsequent
  `ui-store`-driven snapshot push — the snapshot rebuilds the markup, then the
  overlay is re-stamped on top. This is what makes the interaction state
  "survive a snapshot re-render" without putting interaction state into the
  business snapshot (which would violate ADR 0003).
- `focus` is a transient effect (focus the resolved element on apply); `reset`
  clears the overlay entries for the target (back to the snapshot's own state).

To resolve a `target`, the serializer tags every component wrapper with
`data-webapp-node="<id>"` (it already tagged change-controls with
`data-webapp-source`; the node-id tag is added for *all* components). The client
finds `[data-webapp-node="<id>"]` and toggles a `webapp-hidden` class /
`disabled` attribute (and the inner control's `disabled` for form controls).
`open`/`close` on a sub-part finds `[data-webapp-node="<id>"]` then the matching
`[name="<part>"]` / `#<part>` descendant and toggles its `open` attribute.

### 4. Serializer respects the overlay

The shared serializer (`webapp-serializer.js`) is the single render path for
server and client (P26). The overlay lives **only client-side** (it is per-tab
interaction state, never server business state — ADR 0003), so the serializer's
job is simply to emit the stable `data-webapp-node` hook on every wrapper; the
client stamps visibility/disabled after render. Server and client output stay
byte-identical (the overlay application is a post-render DOM pass the server
does not run, since the server has no per-client interaction state).

## Consequences

- Every documented verb now works end to end.
- Interaction state is cleanly separated from business state: it lives in the
  client overlay, re-applied on each render, never round-tripped through the
  snapshot. ADR 0003's "no business logic / no interaction state in the runtime"
  holds.
- `openDialog`/`closeDialog` remain as compatibility aliases; new flows should
  use `open`/`close`.
- `select` is confirmed as canonical vocabulary; its client effect is folded
  into the same overlay (active-part), additive and non-breaking.
