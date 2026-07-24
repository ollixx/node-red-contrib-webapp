# ui-alert

A coloured notice bar for info, success, warning or error messages.

> Deutsch: [de/nodes/ui-alert.md](../de/nodes/ui-alert.md)

## Purpose

`ui-alert` renders a **coloured notice bar** for info, success, warning or
error messages. Both the message and an optional title are fully bindable —
they can come from a literal, a store, state, a query, a route parameter or the
incoming Node-RED message. It has an input port for push updates and an output
port that fires when the user dismisses the alert.

## When to use

- Show a static or data-driven status message inside a route, dialog or
  container (a warning banner, a success confirmation).
- Auto-hide a transient notice after a set time (`duration`), optionally with a
  countdown bar.
- Let the user close a notice (`dismissible`) and react to that in the flow.
- For a **transient pop-up** that floats over the app and dismisses itself,
  reach for [`ui-toast`](ui-toast.md) instead.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Alert N` |
| **Parent Slot** (`mount`) | The slot this alert mounts into. Required. | mount path | — |
| **Title** (`title`) | Optional heading above the message (bindable). Empty → no title area. | canonical value binding | empty |
| **Message** (`message`) | The alert text (bindable). Required. | `literal`, `store`, `state`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | empty |
| **Severity** (`severity`) | Semantic colour role (there is no separate `variant`). | `primary`, `info`, `success`, `warning`, `danger`, `neutral` | `primary` |
| **Icon** (`icon`) | Icon in the alert's icon slot (bindable). | `Kein Icon`/none, `Automatisch`/auto (severity-derived), `Custom …` (any icon name) | none |
| **Dismissible** (`dismissible`) | Show a close (×) button; closing fires the `dismiss` event. | checkbox | off |
| **Duration (ms)** (`duration`) | Auto-hide after N milliseconds. Empty = no auto-hide. | positive integer | empty |
| **Countdown** (`countdown`) | Show a bar counting down the remaining time. Only meaningful with `duration`. | checkbox | off |
| **Visible** (`visible`) | Base field — declarative visibility (bindable boolean). Missing = always shown. | boolean binding | shown |

`Disabled`, `Color` and `Size` are N/A (an alert has no interactive state; its
colour comes from `severity`; it has no size steps).

## The auto icon

With **Automatisch (auto)** the icon follows the severity: `info-circle`
(primary/info), `check-circle` (success), `exclamation-triangle` (warning),
`x-circle` (danger), `circle` (neutral). **Custom** takes any icon name (e.g.
`bell`); **Kein Icon** renders no icon.

## Inputs

`ui-alert` **has an input port** for push updates:

- **`msg.payload`** (non-`null`) overrides `message` as a literal and pushes a
  fresh snapshot to all clients; other fields stay unchanged.
- **`msg.ui.patch`** — overrides any field of the node definition (`message`,
  `severity`, `title`, `dismissible`, …); binding fields must be a binding
  object (`{ "kind": "literal", "value": "…" }`).
- **`msg.ui.component.op`** (`show`, `hide`, `enable`, `disable`, …) — controls
  visibility/interaction like every view node.
- Unrecognised / foreign messages **pass through unchanged**.

`duration` is a declarative writer on the alert's single visibility value: after
the time elapses the node sets `visible = false` (writing through to the bound
store, or the per-client slot when unbound). Writing `true` again re-shows it.

## Outputs / Events

`ui-alert` **has an output port**. It emits a `dismiss` event when the user
clicks the close icon (only when `dismissible: true`); pass-through messages
leave this port unchanged.

| Event | When | `msg.ui` fields |
|---|---|---|
| `dismiss` | user clicks the close icon | `event: "dismiss"`, `appId`, `clientId`, `sourceId` |

## Examples

### 1. A dismissible warning alert

A warning alert with a title, a message and the auto icon; the user can close
it. A plain heading sits above it so the app root is never empty.

Flow file: [`examples/guide/ui-alert.json`](../../../examples/guide/ui-alert.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-alert.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideAlert/` — the warning alert
   appears with a close button.

## Related

- [`ui-toast`](ui-toast.md) — a transient, self-dismissing pop-up notification
- [`ui-badge`](ui-badge.md) — a small inline status pill
- [Bindings & State](../guides/bindings-state.md) — the binding kinds, stores
- Contract doc (internal, German): `docs/nodes/feedback/ui-alert.md`
