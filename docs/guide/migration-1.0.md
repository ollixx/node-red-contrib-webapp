# Migrating to 1.0

> Deutsch: [de/migration-1.0.md](de/migration-1.0.md)

If you built flows against a pre-1.0 build of these nodes, this page explains
every breaking change and what (if anything) you need to do.

**Short version: you don't need to hand-edit anything.** All the renames and the
one node removal below are **auto-migrated when Node-RED loads and re-saves your
flow**. Open the affected node (or just deploy) and the canonical fields are
written; the runtime keeps reading the legacy fields in the meantime. This page
exists to *explain* the changes, not to give you a manual checklist.

## `ui-navigation` is gone — navigation is a `ui-action`

The `ui-navigation` node has been removed. Navigation is now solely a
**`ui-action`** with `actionType: "navigate"`
([ADR 0040](../adr/0040-retire-ui-navigation-node-navigate-is-a-ui-action.md)).

Why: `ui-navigation` was a deprecated alias whose editor offered route/url/wire
modes and typed params, but whose runtime only ever honoured the plain `to`
target — a route-mode node could validate green and then silently do nothing.
`ui-action` navigate is the single, fully-wired model (with the three target
modes: wire / route / url).

**Migration:** every functioning `ui-navigation` was a `url`-mode node carrying a
`to` value; its exact equivalent is a `ui-action` with
`actionType: "navigate"`, `targetMode: "url"`, the same `to`, and the same
`app`. The node-set transform performs this rewrite automatically, so existing
flows keep working. When you next edit navigation, use a `ui-action` node.

## Field renames (auto-migrated on open/save)

A cross-node field-model cleanup
([ADR 0038](../adr/0038-field-model-consistency-naming-and-carrier-normalization.md))
made the reference-field names consistent. The runtime reads the legacy field
name and writes the canonical one on save, so **no flow breaks and no manual
change is required**:

| Legacy field   | Canonical field | Where                                   |
|----------------|-----------------|-----------------------------------------|
| `parent`       | `app`           | every non-app node (names the owning app; `mount` stays the render slot) |
| `layoutId`     | `layout`        | `ui-route`, `ui-dialog`, `ui-container` |
| `routeId`      | `route`         | route references (e.g. `ui-action` navigate route mode) |
| `definitionId` | `definition`    | `ui-component-instance`                 |
| `rows`         | `lines`         | `ui-textarea` (the line-count/height field; `rows` now means only "data rows", e.g. on `ui-table`) |

The rule behind the renames: a reference-by-id field uses the **bare concept
name** (the value *is* the id) — matching `store`/`mount` — rather than an `Id`
suffix. `parent` was misleading (it held the owning app id, not a slot parent),
so it became `app`.

## What you should actually do

1. Open your flow in Node-RED 4.x with 1.0 installed.
2. **Deploy once.** The auto-migration writes the canonical fields.
3. If you used `ui-navigation` nodes, replace them with `ui-action` navigate
   nodes at your convenience (the transform keeps them working until you do).

That's it. For the field model in full see
[Layout & Slots](guides/layout-slots.md) and
[Bindings & State](guides/bindings-state.md); for navigation see
[Navigation & Dialogs](guides/navigation-dialogs.md).
