# ADR 0017: ui-repeat — generic template container with render-time item scope

- Status: accepted
- Date: 2026-06-12
- Builds on: P140 (Repeats concept — this ADR resolves it), the renderer's
  existing keyed morph, [ADR 0011](0011-ui-action-navigation-target-modes-and-dual-path-coding.md)
  (wire vs reference duality), [ADR 0016](0016-ui-query-trigger-model-visible-no-auto-fire.md)
  (reads may be reactive). Governs the new `nodes/ui-repeat` epic.

## Context

There is no way to render a component **n× from data** (e.g. a card per item of
an array in a store/query). Lists are only expressible via pre-known,
individually-mounted nodes or specialised leaf nodes (`ui-table`, `ui-list`).
P140 parked this pending an ADR + owner decision on the data source, template
model, scope, keying, and per-instance events.

Owner proposal (2026-06-11/12): a `ui-repeat` node bound to a list/object, with a
**default slot as the template container**; children bind **relative to the
current item**; the wire path feeds the array in as a message.

Two questions were load-bearing and are decided here.

### Q1 — one node or two? (ui-repeat vs ui-list)

Decided: **two nodes, distinct contracts** (owner: "A"). The distinction that
matters is **leaf widget vs template container**:

- `ui-list` stays a **leaf** — fixed item schema `{id,label,value,icon}`, list
  chrome (dividers/compact/list a11y), no children. The bequeme 80%-case.
- `ui-repeat` is a **container** — a default slot holding an arbitrary child
  subtree, repeated per item, no chrome.

The small overlap (a plain text list expressible either way) is **accepted, not
redundant** — it is the price of "the simple case stays simple" (Node-RED-first).
Rejected: folding both into one dual-mode node (overloads one node with two very
different contracts and wraps list chrome around arbitrary children).

### Q2 — how does the item context reach the children?

Decided: **render-time scope** (owner choice), **not** a store write-through. The
item context is a render-time construct passed down the tree — exactly like
`routeParam` today, which is resolved at render and not persisted. Rejected:
writing a per-item context into a store (multi-client collisions, throwaway write
traffic, the store becomes a scratch buffer).

## Decision

### 1. `ui-repeat` is a template container

A new node `ui-repeat` with a **default slot** that holds the repeated child
subtree (the *template*). The renderer **clones the template per item** of the
bound collection. `ui-list` is unchanged and remains the leaf list widget.

### 2. Data source — `items`, bindable (read side)

`items` is a standard value-typedInput (literal/state/query/store/routeParam/
reactive/…). It resolves to an **array** (an object is iterated as entries
`{key, value}`). Reactive: when the source changes, the repeat re-renders. This
is a **read** — reactivity is fine (ADR 0016). The **wire path** is the same as
`ui-list`'s `msg.payload` today: an inbound array **sets `items`**, then the
renderer does the n× expansion. ("items einzeln an die Kinder" is the render
iteration, **not** a literal message fan-out — UI children are mounted, not
wired.)

### 3. Item scope — new binding kind `item` / `index`

A new binding kind makes children bind relative to the current iteration:

- `item` → the whole current element; `item.<path>` → a one-or-more-level field
  (e.g. `item.name`, `item.address.city`).
- `index` → the zero-based position.

The scope is **render-time**: the renderer pushes the current `{item, index}`
onto a scope as it clones, resolves `item.*`/`index` against it, and pops. No
persistence, no store side effect. Outside any `ui-repeat`, an `item`/`index`
binding resolves to undefined (and is an editor-validateable misuse).

### 4. Identity — keyed clones

A repeated child's node id is no longer unique. The renderer composes a
**stable per-instance key = `itemKey × childId`**, where `itemKey` comes from an
item `key`/`id` field when present, else the array index. This feeds the existing
keyed morph so focus/scroll/DOM survive reorder and incremental change.

### 5. Stage 1 is read-only; writing from a row is Stage 2

Reading inside a repeat (display `item.*`) ships first. **Writing** from within a
row (e.g. a `ui-input` whose value targets `item.name` → `items[i].name`) needs
an item-relative **write target** and is explicitly deferred to a Stage 2
package — it must not block the first ADR/implementation.

### 6. Per-client

The repeat renders per client like the rest of the tree (P15): the resolved
`items` and the cloned subtree are part of that client's snapshot. No new
per-client machinery beyond what bindings already carry.

## Consequences

- **Resolves P140.** New epic `nodes/ui-repeat` with a concrete, layered package
  wave: schema (node def + `item`/`index` binding kind) → renderer (template
  clone, render-time scope, keyed morph) → editor/node (registration, template
  slot, `items` typedInput).
- **`item`/`index` is a new binding kind** in the schema's binding union and in
  the renderer's resolver (today: literal/state/query/routeParam/store/reactive).
  It is **scope-local**, unlike the others.
- **Writing from a row (Stage 2)** is a follow-up: item-relative write target +
  the input/store contract inside a repeat.
- **ui-list is untouched** and is **not** sugar over ui-repeat (may be revisited
  later, explicitly out of scope here).
- **Unblocks dynamic slots** [[P142]] partially (repeats are the per-item
  mechanism); Components [[P141]] stay separate.
- No change to the trigger model (ADR 0016) — `items` is a read, not a trigger.
