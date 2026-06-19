# ADR 0023: named repeat scopes — address an outer item in nested ui-repeats

- Status: accepted
- Date: 2026-06-19
- Builds on: [ADR 0017](0017-ui-repeat-template-container-render-time-scope.md)
  (item/index render-time scope), P182 (scope-local kinds are editor-gated by
  ancestry), P192 (scope propagates through nested containers). Resolves the
  ui-repeat "Offene Punkte" item *explizite Benennung der äußeren Ebene*.

## Context

With nested `ui-repeat`s the **innermost** `item`/`index` frame wins, and an
**outer** repeat's item is **not addressable** (renderer.ts: the scope stack
resolves `item` against the top frame). Owner (2026-06-19) hit exactly this and
asked: how do I reach the item of an enclosing repeat when they're nested?

## Decision

### 1. A `ui-repeat` may NAME its scope (`as`)

`ui-repeat` gains an optional **`itemName`** (alias, the `v-for="customer in
customers"` model). Empty (default) → only the generic `item`/`index` sugar,
unchanged. Set (e.g. `customer`) → the repeat's item is addressable **by name**
from any descendant.

### 2. `item`/`index` gain an optional scope qualifier

The `item`/`index` binding gains an optional **`scope`** = a repeat alias:
- `{kind:"item", path:"name"}` → **innermost** item's `name` (sugar, unchanged).
- `{kind:"item", scope:"customer", path:"name"}` → the `customer`-named repeat's
  item `name`, regardless of how many inner repeats sit between.
- `index` analogously (`{kind:"index", scope:"customer"}` = that level's position).

The renderer resolves a scoped binding against the **named frame** in the scope
stack (each frame carries its repeat's `itemName`); an unscoped `item`/`index`
resolves against the **top** frame as today.

### 3. Editor: enclosing aliases appear as binding types (gated like P182)

The editor already walks the mount ancestry to gate scope-local kinds
(`mountIsInsideRepeat`, P182). It now **collects the aliases** of all enclosing
named repeats and offers each as a binding type (e.g. "customer (Repeat)") with a
path field — exactly the P182 gating, one entry per enclosing named repeat. The
generic `item`/`index` (innermost) stay as before. Unnamed enclosing repeats
contribute no named type (only the innermost sugar).

### 4. Backward compatible

No alias → today's behaviour verbatim. The generic `item`/`index` keep meaning
"innermost". Only adding an `itemName` unlocks by-name addressing.

## Consequences

- **P193** implements it: schema (`ui-repeat.itemName`; `item`/`index` optional
  `scope`), renderer (named-frame resolution), editor (alias collection + types,
  gated like P182), spec/tests.
- Depends on **P192** (the scope must first reach all descendants through nested
  containers, else "by name" has nothing to reach).
- Reactive ([[P185]]): a named scope could later expose `customer`/`index`-of as
  reactive locals too — follow-up, not in scope here.
- Resolves the ui-repeat nested-level open point; deep nesting becomes explicit
  and unambiguous (name beats positional guessing).
