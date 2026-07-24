# ui-badge

A small status indicator or count, usually attached to another element.

> Deutsch: [de/nodes/ui-badge.md](../de/nodes/ui-badge.md)

## Purpose

`ui-badge` renders a **small status indicator or marker** — typically a count or
label sitting next to a button or navigation entry. The displayed value comes
from a binding (state, store or the incoming message). The shape (`displayType`)
and the semantic colour role (`variant`) are configured independently.

## When to use

- Show an unread/count badge (inbox, notifications, cart).
- Show a small status pill (Active, Draft, Error) driven by a binding.
- For a full-width in-page notice, use [`ui-alert`](ui-alert.md) instead.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Badge N` |
| **Parent Slot** (`mount`) | The slot this mounts into. Required. | mount path | — |
| **Value** (`value`) | The displayed value, a count or label (bindable). Required. Empty → empty badge; `null`/object → `?`; `0`/`false` are valid. | `literal` (str), `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | empty |
| **Display Type** (`displayType`) | The badge shape (a display type, not a semantic variant). | `rounded`, `pill` (rounded ends), `square` | `rounded` |
| **Variant** (`variant`) | The semantic colour role. | `neutral`, `primary`, `info`, `success`, `warning`, `danger` | `neutral` |
| **Pulsating** (`pulsating`) | Pulse the badge to draw attention (Shoelace `pulse`). | checkbox | off |
| **Visible** (`visible`) | Base field — declarative visibility (bindable boolean). | boolean binding | shown |

`Disabled` and `Size` are N/A (a badge has no interactive state; there is
deliberately **no size field** — Shoelace has no native badge sizing, so size is
handled by theme/CSS at the use site if needed).

## Inputs

`ui-badge` **has an input port** for push updates:

- **`msg.payload`** updates `value` and pushes a fresh snapshot; other fields
  stay unchanged.
- **`msg.ui.patch`** — overrides fields (`value`, `displayType`, `variant`,
  `pulsating`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — controls visibility.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

None — `ui-badge` has no output port and emits no events.

## Examples

### 1. A pulsating count badge

A danger-coloured pill badge showing "3" that pulses, next to an "Inbox"
heading.

Flow file: [`examples/guide/ui-badge.json`](../../../examples/guide/ui-badge.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-badge.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideBadge/` — a red pulsing "3"
   badge appears.

## Related

- [`ui-alert`](ui-alert.md) — a full-width in-page notice bar
- [Theming & Components](../guides/theming-components.md) — variants vs. display types
- [Bindings & State](../guides/bindings-state.md) — the binding kinds, stores
- Contract doc (internal, German): `docs/nodes/feedback/ui-badge.md`
