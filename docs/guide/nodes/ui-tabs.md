# ui-tabs

A tab bar with one content slot per tab, switching between views in place.

> Deutsch: [de/nodes/ui-tabs.md](../de/nodes/ui-tabs.md)

## Purpose

`ui-tabs` renders a **tab bar**. The active tab decides which content is shown;
the others are hidden. Each tab is its own [`ui-tab`](ui-tab.md) child mounted
into this `ui-tabs` — **mounting into a `ui-tabs` is what declares a tab**. There
is no tabs-JSON field. The active tab is a **two-way binding** (`activeTab`): it
reads the active tab id from a store/state, and switching tabs emits a
`tabChange` event carrying the new id for a write-back round-trip.

## When to use

- Switch between several content sections in a shared container (form areas,
  work views) without navigating away.
- Persist and share the active tab across reloads via a store round-trip.
- For collapsible stacked sections (not one-at-a-time content), use
  [`ui-accordion`](ui-accordion.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Tabs N` |
| **Parent Slot** (`mount`) | The slot this tab bar mounts into. Required. | mount path | — |
| **Active Tab** (`activeTab`) | **Two-way** binding on the active tab's id (= a `ui-tab` child id). Reads the active tab; the tab switch emits `tabChange` for the write-back loop. Invalid value → first child. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` (default type `string`) | first `ui-tab` by `order` |
| **Variant** (`variant`) | Non-colour appearance of the bar, emitted as `data-variant` for adapter CSS (not a colour role). | `line`, `contained`, `pills` | `line` |
| **Events** (`events`) | Enables the `tabChange` output port. | `tabChange` | none |
| **Visible** / **Disabled** / **Color** | Base fields. | — | — |

`Size` is N/A (no size steps). **Tabs come from children:** create one `ui-tab`
per tab and mount it into this `ui-tabs`; the tab's content mounts into that
`ui-tab`'s `content` slot. Child tab ids must be **unique** (the id is the slot
key and the `activeTab` value).

## Inputs

`ui-tabs` **has an input port**:

- **`msg.payload`** — sets the active tab; the value must be a `ui-tab` child id
  (invalid → first child).
- **`msg.ui.patch`** — overrides fields (e.g. `activeTab` binding, `variant`).
- **`msg.ui.component.op`** (`show`, `hide`) — toggles the whole block.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

When `tabChange` is enabled, `ui-tabs` has one output port:

| Event | When | `msg.ui` fields |
|---|---|---|
| `tabChange` | user switches the active tab | `event: "tabChange"`, `params.tabId`, `clientId`, `sourceId`, `appId` |

**Two-way write-back:** wire `tabChange` → (extract `params.tabId`) →
`ui-store-action` (`set`) on the same store the `activeTab` binding reads. Now the
active tab survives reloads and stays in sync. With no event enabled the node
emits nothing.

## Examples

### 1. Two tabs with a store write-back round-trip

An "Overview"/"Details" tab bar. `activeTab` reads a store value; `tabChange`
writes the chosen tab id back to that store — the canonical two-way loop.

Flow file: [`examples/guide/ui-tabs.json`](../../../examples/guide/ui-tabs.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-tabs.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideTabs/` — click a tab; the panel
   switches and the chosen tab id is written to the store.

## Related

- [`ui-tab`](ui-tab.md) — a single tab (child of this node)
- [`ui-accordion`](ui-accordion.md) — stacked collapsible sections
- [Bindings & State](../guides/bindings-state.md) — two-way bindings, stores
- Contract doc (internal, German): `docs/nodes/navigation/ui-tabs.md`
