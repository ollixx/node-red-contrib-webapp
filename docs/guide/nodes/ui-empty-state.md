# ui-empty-state

A structured placeholder for empty lists, failed loads or missing content.

> Deutsch: [de/nodes/ui-empty-state.md](../de/nodes/ui-empty-state.md)

## Purpose

`ui-empty-state` renders a **structured placeholder** — an icon, a title, a
message and an optional call-to-action button — for empty lists, failed loads or
content that does not exist yet. It appears while its visibility binding is
truthy, typically when a list is empty or a query returned nothing.

> **Note on the current shape.** A redesign of this node is planned (P152,
> currently deferred). The fields below describe the node **as it is today** —
> `title`, `message` and `icon` are plain text fields (not bindings), and
> `action` is a plain `ui-action` node id. This page makes no promise about the
> future shape.

## When to use

- Show a friendly "nothing here yet" placeholder when a list/query is empty.
- Offer a call-to-action (e.g. "Add the first item") wired to a `ui-action`.
- For a loading placeholder that mimics the shape of content, use
  [`ui-skeleton`](ui-skeleton.md) instead.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Empty State N` |
| **Parent Slot** (`mount`) | The slot this mounts into. Required. | mount path | — |
| **Visible Path** (`visiblePath`) | State path controlling visibility. Truthy = empty-state shown (no data / error). Required. | plain state path | — |
| **Icon** (`icon`) | Icon name from the Shoelace set. Empty → no icon. | text | empty |
| **Title** (`title`) | The placeholder heading (e.g. "No entries"). Plain text. | text | empty |
| **Message** (`message`) | Supporting text under the title. Plain text. | text | empty |
| **Action** (`action`) | A `ui-action` node id; when set, a CTA button is rendered. | ui-action id | empty |
| **Action Label** (`actionLabel`) | The CTA button caption. Shown only when `action` is set. | text | empty |
| **Color** (`color`) | Base field — text/icon colour (bindable). | value binding | theme |

`Disabled` and `Size` are N/A (an empty-state has no interactive state and no
size steps). There is no `variant`/`severity` — the node inherits the parent
app's theme. Visibility is the node's own `Visible Path` field (the shared
`visible` base row is omitted here).

## Inputs

`ui-empty-state` **has an input port** for push updates:

- **`msg.ui.patch`** — overrides fields (`icon`, `title`, `message`,
  `actionLabel`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — controls visibility alongside
  the `Visible Path` binding.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

None — `ui-empty-state` has no output port. Clicking the CTA button triggers the
wired `ui-action`; its events originate there.

## Examples

### 1. An empty-state driven by a store

A `ui-store` seeds `isEmpty = true`; the empty-state's `Visible Path` points at
it, so the icon/title/message placeholder is shown. A heading sits above it.

Flow file: [`examples/guide/ui-empty-state.json`](../../../examples/guide/ui-empty-state.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-empty-state.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideEmpty/` — the "No customers yet"
   placeholder appears.

## Related

- [`ui-skeleton`](ui-skeleton.md) — a loading-shape placeholder
- [`ui-action`](../guides/actions-events.md) — the CTA button target
- [Bindings & State](../guides/bindings-state.md) — the state/store bindings
- Contract doc (internal, German): `docs/nodes/feedback/ui-empty-state.md`
