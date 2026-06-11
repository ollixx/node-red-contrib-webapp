# ADR 0015: standardized common base fields + node-editor structure

- Status: accepted
- Date: 2026-06-11
- Builds on: [ADR 0012](0012-binding-ubiquity-every-value-field-offers-bindings.md)
  (binding ubiquity; `disabled` as boolean-state), the variant=colour convention,
  P71 (`size`). Relates to P102 (capability/backend-support map, deferred).

## Context

Node editors grew inconsistently: `ui-skeleton` carries a one-off `visiblePath`
field, some nodes have `size`/`variant` and some don't, and the layout fields
(order/row/col) sit ungrouped. The owner proposed (2026-06-11) a standard set of
**common base fields** present on every node, with clear grouping, so the editor
is predictable.

Owner decisions (2026-06-11):
1. The on/off field is **`disabled`** (already rolled out, ADR 0012) — not a new
   `enabled`.
2. **`color`** is a **general** base field for all nodes; **`variant`** (semantic
   colour: neutral/primary/success/…) stays **node-specific** and is **not** in
   the base set.
3. "Which base field is N/A for a given node" is determined **node-local** for
   now; a central capability map (P102) can drive it later without blocking.

## Decision

### 1. The common base-field set: `visible`, `disabled`, `color`, `size`

Every node offers these four as standard fields (binding kinds per ADR 0012):

- **`visible`** — boolean-state binding (Store/Query/Route-Param/Reactive/msg/
  JSONata/boolean/Flow/Global/Env). Default: visible. Replaces one-off
  visibility fields (e.g. `ui-skeleton.visiblePath` → P138).
- **`disabled`** — boolean-state binding (already standard, ADR 0012). For
  non-interactive nodes this is the N/A case (see §3).
- **`color`** — a **general** colour for the element. **Mutually exclusive with
  `variant`:** a node that has the semantic `variant` field does **not** get a
  separate `color` — on such nodes the base `color` is the N/A case (shown
  disabled with the hint "uses semantic Variant"). Per node, the rollout decides
  whether its colour is served by `variant` (then `color` is N/A) or by `color`.
- **`size`** — the element size (the existing `size` token where applicable).

`variant` is **not** a base field — it remains where its semantic colours make
sense (button/badge/alert/text…), unchanged.

### 2. Editor structure: grouping, headings, collapse

- The base fields sit in a **grouped section** (its own heading).
- The **layout fields** (order/row/col/colSize/rowSize/layoutX/layoutY) get a
  **"Layout"** heading for their section — applied centrally where the placement
  rows are injected, so it lands on every node at once.
- **All base fields are visible by default.** Rarely-used fields may sit in a
  **collapsible** ("Erweitert") sub-section, collapsed by default; the collapse
  state is a pure editor affordance.

### 3. N/A fields are shown, disabled, with a hint

A base field that does not apply to a node is **rendered but disabled**, with a
short **hint why** (e.g. `disabled` on a non-interactive node → "this node has no
interactive state"; `color` on a variant-node → "uses semantic Variant";
`size`/`color` on a node that does not render them). Knowing **which** field is
N/A is **node-local** for now — each node declares its applicable base fields (a
small per-node capability flag). A **central capability map** (P102) may later
replace the scattered flags; the base-field work does **not** block on it.

## Consequences

- **Foundation package P139** (active): a shared `installBaseFields()` editor
  helper that renders the grouped base-field section (visible/disabled/color/
  size) with the heading + collapsible advanced + the per-field N/A-disable-with-
  hint, **plus** the central "Layout" heading on the placement-row injection.
  Proven on a reference node (browser).
- **Per-node rollout** follows P139: apply `installBaseFields` to each node,
  declaring its applicable fields and mapping colour to `variant` vs `color`.
  Large; cut per node (or folded into each node's review), like the ADR-0012
  rollout. `disabled` is already done (P122–P130); `visible`/`color`/`size` are
  added where missing.
- Docs: `docs/nodes/concepts/editor.md` gains the base-field + structure section.
