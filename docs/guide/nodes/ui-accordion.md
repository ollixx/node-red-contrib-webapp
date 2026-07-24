# ui-accordion

A list of collapsible sections — stacked panels that expand and collapse in
place.

> Deutsch: [de/nodes/ui-accordion.md](../de/nodes/ui-accordion.md)

## Purpose

`ui-accordion` renders a **list of collapsible sections**. Each section has a
header and a content slot; open sections show their content, closed ones hide it.
Each section is its own [`ui-accordion-section`](ui-accordion-section.md) child
mounted into this accordion — **mounting into a `ui-accordion` is what declares a
section**. The open section is a **two-way binding** (`openSection`). In
single-open mode (`multiple: false`, the default) opening a section **closes the
others** — this is real behaviour.

## When to use

- FAQ-style content, grouped settings, or any stacked sections that expand in
  place without navigating away.
- Keep only one section open at a time (default) or allow several
  (`Allow Multiple Open`).
- For switching whole views one at a time in a bar, use [`ui-tabs`](ui-tabs.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Accordion N` |
| **Parent Slot** (`mount`) | The slot this accordion mounts into. Required. | mount path | — |
| **Open Section** (`openSection`) | **Two-way** binding on the open section's id (= a section child id). Reads the open section; a section change emits an event for the write-back loop. Invalid → first section. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` (default type `string`) | first section by `order` |
| **Allow Multiple Open** (`multiple`) | `true` — several sections open at once. `false` — only `openSection` is open (opening one closes the others). | checkbox | off (single-open) |
| **Events** (`events`) | Enables `sectionOpen` / `sectionClose` output ports. | `sectionOpen`, `sectionClose` | none |
| **Visible** / **Disabled** / **Color** | Base fields. | — | — |

`Size` is N/A (no size steps). **Sections come from children:** create one
`ui-accordion-section` per section and mount it into this accordion; the section's
content mounts into that child's `content` slot. Section ids must be **unique**
(the id is the slot key and the `openSection` value).

## Inputs

`ui-accordion` **has an input port**:

- **`msg.payload`** — sets the open section; the value must be a section child id
  (invalid → first section).
- **`msg.ui.patch`** — overrides fields (e.g. `openSection` binding, `multiple`).
- **`msg.ui.component.op`** — `show`, `hide` toggle the whole block; `open`,
  `close` open/close a section by its `part` (= section id).
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

One output port per enabled event:

| Event | When | `msg.ui` fields |
|---|---|---|
| `sectionOpen` | user opens a section | `event: "sectionOpen"`, `params.sectionId`, … |
| `sectionClose` | user closes a section | `event: "sectionClose"`, `params.sectionId`, … |

**Two-way write-back:** wire `sectionOpen` → (extract `params.sectionId`) →
`ui-store-action` (`set`) on the store the `openSection` binding reads. With no
event enabled the node emits nothing.

## Examples

### 1. A single-open FAQ with a store write-back

Three FAQ sections, single-open (opening one closes the others). `openSection`
reads a store value; `sectionOpen` writes the opened id back — the two-way loop.

Flow file: [`examples/guide/ui-accordion.json`](../../../examples/guide/ui-accordion.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-accordion.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideAccordion/` — open a section;
   the others collapse and the opened id is written to the store.

## Related

- [`ui-accordion-section`](ui-accordion-section.md) — a single section (child)
- [`ui-tabs`](ui-tabs.md) — switch whole views one at a time
- [Bindings & State](../guides/bindings-state.md) — two-way bindings, stores
- Contract doc (internal, German): `docs/nodes/navigation/ui-accordion.md`
