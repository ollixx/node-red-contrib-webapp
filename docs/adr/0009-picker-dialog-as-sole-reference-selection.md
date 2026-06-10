# ADR 0009: picker dialog as the sole selection mechanism for reference fields

- Status: accepted
- Date: 2026-06-10
- Builds on: [ADR 0007](0007-action-message-and-per-node-interaction-handlers.md)
  (which introduced the canvas picker as a *separate* paradigm; the list dialog
  itself dates from P68).

## Context

Almost every webapp node references other nodes in its property panel: the
parent app (`#node-input-parent`), a route (`#node-input-routeId`), an action,
a store — and above all the **parent slot** (`#node-input-mount`), which every
non-app node must set. These fields are currently plain `<select>` elements,
fully populated from the editor graph.

Two mechanisms coexist today in `resources/lib/editor-common.js`:

1. The unified **node-picker dialog** (P68, `openNodePickerDialog`) — a
   scrollable, searchable list with presets (`apps`, `routes`, `actions`,
   `stores`). App/route/action/store selects already get an "open dialog"
   button next to them via `enhanceSelectWithPicker`, but the fully populated
   dropdown remains the primary UI.
2. The **mount select** is the odd one out: `setSelectOptionsTree` builds a
   long `<select>` with `<optgroup>`s (apps → routes/dialogs → containers →
   slots) and has **no** dialog integration at all — there is no `mounts`
   preset.

As flows grow, these dropdowns become unusably long. The mount field is the
worst case because every view node has one and the option count grows with
every app, route, dialog, container and slot. A long native dropdown offers no
search, no filtering, and poor readability for hierarchical entries.

The owner's decision (2026-06-10): *"Das wird schnell eine lange Liste in der
SelectBox. Wir haben dafür schon einen Dialog. Wir sollten gleich diesen Dialog
benutzen. Immer. Und daher überall einbauen."* Clarified: the dialog is the
**only** selection mechanism (the long dropdown disappears), and the same
pattern applies to **all** reference fields, not just the parent slot.

## Decision

### 1. One pattern for every reference field

Every field that references another webapp node — parent app, route, action,
store, **and parent slot/mount** — is rendered as:

- a **read-only display** of the current selection (human-readable label; for
  mounts the full breadcrumb, e.g. `Shop > /customers > content`), showing a
  placeholder when empty, plus
- an **"Auswählen…" button** that opens the unified P68 picker dialog
  (search/filter, click to select).

The fully populated, visible `<select>` dropdown is no longer offered anywhere.
The bound `#node-input-*` element stays in the DOM as the **hidden value
carrier**, so Node-RED's defaults binding, `change` events, validation and the
save round-trip are unchanged.

### 2. A `mounts` preset for the picker

The picker gains a `mounts` preset: the existing mount-option tree
(`buildMountOptionsTree`) is flattened into dialog entries whose labels carry
the full breadcrumb path. Hierarchy stays readable through the breadcrumb;
search matches the breadcrumb and the mount value.

### 3. Why this and not the alternatives

- *Keep dropdown + add a dialog button (status quo for apps/routes/…):*
  rejected — it does not solve the stated problem; the long list stays the
  primary UI and the mount field would still need its own tree builder.
- *A second, hierarchical picker for mounts only:* rejected — P68's rule is
  **one** picker dialog everywhere (the store typedInput and route/action
  fields already reuse it); a second picker reintroduces divergence.
- *Native `<optgroup>` styling improvements:* rejected — native selects cannot
  search, and admin-UI dropdown UX does not scale with flow size.

## Consequences

- One selection idiom across all panels; per-node HTML keeps working through
  the central installers (`installParentAppSelector`,
  `installReferenceSelectors`) — the change lands once in
  `resources/lib/editor-common.js`.
- `enhanceSelectWithPicker` (dropdown + button) is **superseded** by the
  display+button pattern; `setSelectOptionsTree` and the unused flat
  `buildMountOptions` lose their UI role (the tree builder survives as the
  data source for the `mounts` preset).
- Stored config values are untouched (node ids; mount strings
  `<type>:<id>/<slot>`) — no schema, runtime or flow migration.
- E2E specs that open the native dropdowns (`editor-mount-options.spec.ts`,
  `parent-selector.spec.ts`, `node-picker.spec.ts`) must be rewritten against
  the dialog-only pattern.
- Roadmap: implemented by **P114** (`docs/roadmap/aspects/editor/`).
