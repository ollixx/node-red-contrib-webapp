# ui-tab

A single tab inside a [`ui-tabs`](ui-tabs.md) — a thin container for one tab's
title and content.

> Deutsch: [de/nodes/ui-tab.md](../de/nodes/ui-tab.md)

## Purpose

`ui-tab` is one **tab** of a [`ui-tabs`](ui-tabs.md) bar. It carries the tab's
`label` (and optional `icon`) and provides a `content` slot for the tab's panel.
**The mounted children define the tabs** — mounting a `ui-tab` into a `ui-tabs`
*is* the tab declaration; there is no tabs-JSON field. `ui-tab` renders no chrome
of its own — the parent `ui-tabs` renders the tab nav entry and panel.

## When to use

- Add a tab to a [`ui-tabs`](ui-tabs.md): create a `ui-tab`, mount it into the
  `ui-tabs`, and mount the tab's content into this node's `content` slot.
- For data-driven tabs, wrap a single `ui-tab` in a
  [`ui-repeat`](ui-repeat.md) (one tab per row).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Tab N` |
| **Parent Slot** (`mount`) | Mount target: a `ui-tabs`. Mounting into it makes this a tab. Required. | mount path | — |
| **Label** (`label`) | The tab title (bindable). Without a label the node id is shown. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` (default type `string`) | node id |
| **Icon** (`icon`) | Optional icon name (`<sl-icon>`) shown beside the label. | free text | — |

The base fields (`visible`/`disabled`/`color`/`size`/`variant`) are **N/A** — a
tab renders no chrome of its own; a tab's visibility is governed by the parent's
`activeTab` selection. The node id is the tab key (the `activeTab` value) and must
be unique within one `ui-tabs`.

## Inputs

`ui-tab` has **no input port** — it is a pure structural/container node. The tab
switch and `tabChange` event live on the parent [`ui-tabs`](ui-tabs.md).

## Outputs / Events

None — `ui-tab` has no output port.

## Examples

The tab example lives with the parent: two `ui-tab` children define an
Overview/Details tab bar, each with its own panel content.

Flow file: [`examples/guide/ui-tabs.json`](../../../examples/guide/ui-tabs.json)
(see [`ui-tabs`](ui-tabs.md) for import instructions and the two-way write-back).

## Related

- [`ui-tabs`](ui-tabs.md) — the parent tab bar (`activeTab`, events)
- [`ui-repeat`](ui-repeat.md) — data-driven tabs (one `ui-tab` per row)
- Contract doc (internal, German): `docs/nodes/navigation/ui-tab.md`
