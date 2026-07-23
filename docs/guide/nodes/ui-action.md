# ui-action

The typed emitter of interaction commands — navigate, show/hide, open/close,
select, enable/disable, focus, reset. It changes UI interaction state, never
business data.

> Deutsch: [de/nodes/ui-action.md](../de/nodes/ui-action.md)

## Purpose

`ui-action` is the convenient, **typed emitter** of the `msg.ui.action`
contract. On input it builds a schema-valid `msg.ui.action` from its config
(overridable by `msg.ui.action.*`) and emits the enriched message. An action
only ever changes the **interaction state** of the UI (navigation, visibility,
enabled state, focus) — **never business data** (that is [`ui-store`](../nodes/ui-store.md)).
The SSE push is performed by the **wired target node**, not by `ui-action`.
Navigation is now **only** a `ui-action` with `navigate` (the retired
`ui-navigation` node — ADR 0040).

## When to use

- Navigate to a route or URL from a button/flow.
- Show/hide or enable/disable a target (during a request, on a condition).
- Open/close a dialog, drawer, accordion section; select one of a sibling group.
- Focus a text control; reset a form control to its initial value.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and pickers. | free text | `Action N` |
| **App** | The parent `ui-app` — the routing context. Required. | app reference | — |
| **Action-Typ** (`actionType`) | The pre-set verb (overridable via `msg.ui.action.type`). Empty = unspecified (type comes from the msg). | see verbs below | empty |
| **Beschreibung** (`description`) | Free-text note documenting the action in the editor. | free text | empty |
| **Ziel** (`targetMode` + `route`/`to`) | Navigation target source, shown only for `navigate` — a segment switch: **via Wire** (the receiving route builds the location), **Route** (a picked `ui-route` + typed params), **URL** (a whole URL in `to`). | `wire` / `route` / `url` | per migration |
| **Ziel-Knoten** (`targets`) | Optional canvas-picked target node ids — the secondary "wireless" path (delivered via `receive()`). Primary is wiring the output port. | node ids | empty |
| **Teil (Sub-ID)** (`part`) | Sub-id within the target for `open` / `close` / `select` (e.g. accordion section, tab name). Overridable via `msg.ui.action.part`. | sub-id | empty |

## The verbs

Each verb is delivered to the **wired target**; a target that does not own the
verb passes it through unchanged.

| Verb | What it does | Mini-example |
|---|---|---|
| `navigate` | change the location (three modes below) — the **canonical** navigation path | `ui-button → ui-action(navigate, url:/customers) ` |
| `show` | write the target's `visible` to true (through a store if bound) | `ui-action(show) → ui-container "Errors"` |
| `hide` | write the target's `visible` to false | `ui-action(hide) → ui-alert` |
| `open` | open a disclosed element (dialog, drawer, accordion) — optional `part` | `ui-action(open) → ui-dialog "Confirm"` |
| `close` | close a disclosed element | `ui-action(close) → ui-dialog` |
| `select` | activate exactly one of a sibling group via `part` | `ui-action(select, part:tab2) → ui-tabs` |
| `enable` | write the target's `disabled` to false | `ui-action(enable) → ui-button "Save"` |
| `disable` | write the target's `disabled` to true (e.g. during a request) | `ui-action(disable) → ui-button "Save"` |
| `focus` | focus a text control (`ui-input`/`ui-textarea`/`ui-datepicker`) | `ui-action(focus) → ui-input "Search"` |
| `reset` | reset a form control to its initial value and fire `change` | `ui-action(reset) → ui-input "Name"` |

`show`/`hide` and `enable`/`disable` write the target's one dynamic-state value
(ADR 0037); `open`/`close`/`select`/`focus` push an SSE command. `openDialog` /
`closeDialog` remain accepted as aliases of `open` / `close`.

### The three navigate modes (ADR 0011)

- **wire** — no explicit target in the message; the receiving `ui-route` builds
  the location from its own `path`.
- **route** — the picked route reference is resolved app-globally; the typed
  `params` fill its `:placeholders`; the location rides in `msg.ui.action.to`.
- **url** — `to` / `toType` provide the whole URL; no `params`.

An already-addressed navigate (mode `route`/`url`, or `msg.ui.action.to`) is
passed through by a receiving route — a wired route does not hijack it.

## Inputs

The input port receives a `msg`. Relevant fields:

```
msg.ui.action.type   = "navigate" | "show" | "hide" | "open" | "close" | "select" | "enable" | "disable" | "focus" | "reset"
msg.ui.action.target = <node-id>   ← optional target override (else the target node resolves to itself)
msg.ui.action.part   = <sub-id>    ← for open / close / select
msg.ui.action.to     = <path>      ← explicit navigation target (mode route/url)
msg.ui.action.params = { k: v }    ← named URL params for navigate (runtime override)
msg.ui.clientId      = <client>    ← limit the action to one client (else broadcast)
```

`ui-action` **enriches** the message (does not replace it — foreign fields ride
along) and emits it on the output port. Unknown / foreign messages pass through
unchanged.

## Outputs / Events

The output port emits the `msg.ui.action`-enriched message. The wired target
processes the verb it owns; a verb it does not own is passed through. `ui-action`
itself performs no SSE push.

## Examples

### 1. A button that navigates (canonical)

A home-page button fires a `navigate` (url mode) to a second route; the route's
content renders after navigation.

Flow file: [`examples/guide/ui-action.json`](../../../examples/guide/ui-action.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-action.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideAction/` and click **Go to
   page 2** — the URL becomes `/webapp/guideAction/page2`.

## Related

- [Actions & Events](../guides/actions-events.md) — the direction rule, wire vs. reference
- [Navigation & Dialogs](../guides/navigation-dialogs.md) — the three navigate modes
- [`ui-route`](ui-route.md) / [`ui-dialog`](ui-dialog.md) — navigation / disclosure targets
- [`ui-store`](ui-store.md) — business data (the distinction)
- Contract doc (internal, German): `docs/nodes/behavior/ui-action.md`
