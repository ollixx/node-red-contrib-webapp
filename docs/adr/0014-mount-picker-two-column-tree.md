# ADR 0014: mount (parent-slot) picker — two-column tree, resizable dialog

- Status: accepted
- Date: 2026-06-11
- Builds on: [ADR 0009](0009-picker-dialog-as-sole-reference-selection.md)
  (the unified picker dialog), P114/P117 (the `mounts` preset, app-scope rules).

## Context

The picker dialog (`openNodePickerDialog`) is used in two structurally different
ways (enumerated from the code, 2026-06-11):

- **Flat node reference** (presets `apps`, `routes`, `actions`, `stores`,
  `layouts`): pick **one** node of a type from a filtered, searchable list. No
  hierarchy — a flat list is correct.
- **Parent-slot / mount** (preset `mounts`, the `#node-input-mount` field of every
  view node + container): pick a **slot** in the app structure — App →
  (App-slots / Routes / Dialogs) → Container → **recursive** child containers →
  the **slots** at each level. Today this hierarchy is **flattened** into
  breadcrumb rows (`Shop > /customers > content`).

Owner findings (2026-06-11): the flat breadcrumb list is poor for a large app —
long breadcrumbs force **horizontal scrolling**, and the hierarchy is hard to
navigate. The mount picker should be a **tree**.

## Decision

### 1. The mount picker becomes a two-column (master-detail) browser

Only the **`mounts`** preset changes. The flat reference presets stay flat lists.

- **Left column — the structure tree:** App → (Routes / Dialogs) → Container →
  recursive child containers. **Only structural nodes are branches**; a child
  container nests directly under its **parent node** (not under a slot level —
  slots would otherwise appear both as tree levels and in the right column).
- **Right column — the slots of the left-selected node:** a flat list of that
  node's slots. **Slots are the only selectable leaves** (the pick); left is pure
  navigation.
- **Search (top, always visible):** runs **over the tree**. While a query is
  present, the **left** column becomes a **flat list of matching paths** (the
  branches/paths, **without** slots); the **right** column is **invariant** — it
  still shows the **slots** of the left-selected (matching) path. Empty query →
  the two-column browse view.
- **Not app-scoped** (P117): the mount establishes which app a node belongs to,
  so all apps appear as top-level branches (cross-app moves stay possible).
- **Cycle guard:** when editing a container's own mount, its own subtree is
  excluded from the tree (a container can never mount into its own descendant) —
  the existing `visitedContainers` guard, carried into the tree builder.
- **Empty branches:** a node with no own slots shows "no slots" on the right;
  childless branches are shown but not expandable.
- **Pre-selection:** the current mount's path is expanded and highlighted, its
  slot selected on the right.
- Stored value is unchanged — the mount string `<type>:<id>/<slot>` (or
  `<appId>.<slot>`). Footer shows the full breadcrumb of the current pick.

### 2. The picker dialog is resizable, remembered, and overflow-safe

These apply to the **shared** `webapp-node-picker-*` dialog, so every picker
(node / mount / icon / media) benefits:

- **Resizable:** CSS `resize: both; overflow: auto;` on the dialog container with
  `min-width`/`min-height` and `max-width: 95vw` / `max-height: 90vh` (native
  corner handle, no JS). jQuery UI `.resizable()` only if edge handles are later
  wanted.
- **Size remembered:** the chosen width/height is persisted in `localStorage` and
  restored on the next open.
- **Long labels:** breadcrumb/row labels use `text-overflow: ellipsis` (or wrap)
  rather than forcing horizontal scroll.

## Consequences

- `resources/lib/editor-common.js`: `openNodePickerDialog` gains a tree render
  mode for the `mounts` preset (driven by `buildMountOptionsTree`, which already
  models the hierarchy); the flat presets are unchanged. The shared dialog gains
  resize + persisted size + ellipsis.
- No data contract changes — mount strings and the stored values are identical;
  only the selection UI changes.
- Implemented by **P135**. The flat reference pickers (apps/routes/actions/
  stores/layouts) are explicitly out of scope (they stay flat).
- Docs: `docs/nodes/concepts/editor.md` (picker dialog section) gains the
  two-column tree + resizable behaviour.
