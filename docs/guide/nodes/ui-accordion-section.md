# ui-accordion-section

A single section inside a [`ui-accordion`](ui-accordion.md) — a thin container
for one section's title and content.

> Deutsch: [de/nodes/ui-accordion-section.md](../de/nodes/ui-accordion-section.md)

## Purpose

`ui-accordion-section` is one **section** of a [`ui-accordion`](ui-accordion.md).
It carries the section's `label` (summary) and optional `icon`, and provides a
`content` slot for the collapsible panel. **The mounted children define the
sections** — mounting a section into a `ui-accordion` *is* the section
declaration; there is no sections-JSON field. It renders no chrome of its own —
the parent renders the `<sl-details>` summary and panel. Mirrors
[`ui-tab`](ui-tab.md).

## When to use

- Add a section to a [`ui-accordion`](ui-accordion.md): create a
  `ui-accordion-section`, mount it into the accordion, and mount the section's
  content into this node's `content` slot.
- For data-driven sections, wrap a single section in a
  [`ui-repeat`](ui-repeat.md) (one section per row).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Section N` |
| **Parent Slot** (`mount`) | Mount target: a `ui-accordion`. Mounting into it makes this a section. Required. | mount path | — |
| **Label** (`label`) | The section title/summary (bindable). Without a label the node id is shown. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` (default type `string`) | node id |
| **Icon** (`icon`) | Optional icon name (`<sl-icon>`) shown beside the label. | free text | — |

The base fields (`visible`/`disabled`/`color`/`size`/`variant`) are **N/A** — a
section renders no chrome of its own; its open/closed state is governed by the
parent's `openSection`. The node id is the section key (the `openSection` value)
and must be unique within one `ui-accordion`.

## Inputs

`ui-accordion-section` has **no input port** — it is a pure structural/container
node. The section change and `sectionOpen`/`sectionClose` events live on the
parent [`ui-accordion`](ui-accordion.md).

## Outputs / Events

None — `ui-accordion-section` has no output port.

## Examples

The section example lives with the parent: three section children form a
single-open FAQ, each with its own answer panel.

Flow file: [`examples/guide/ui-accordion.json`](../../../examples/guide/ui-accordion.json)
(see [`ui-accordion`](ui-accordion.md) for import instructions and the two-way
write-back).

## Related

- [`ui-accordion`](ui-accordion.md) — the parent (`openSection`, `multiple`, events)
- [`ui-tab`](ui-tab.md) — the mirror child node for [`ui-tabs`](ui-tabs.md)
- [`ui-repeat`](ui-repeat.md) — data-driven sections (one section per row)
- Contract doc (internal, German): `docs/nodes/navigation/ui-accordion-section.md`
