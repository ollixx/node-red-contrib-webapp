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

### 3. Editor: a validated Scope picker + a reactive `scope()` accessor (NOT one type per alias)

> **Correction (2026-06-20, → P196):** the original §3 below — *one binding type
> per enclosing alias* — was **wrong**: it bloats the value typedInput's type list
> (item/index ×N aliases) and conflates *names* with *types*. The owner caught it.
> Replaced by the two surfaces below; the per-alias-type idea is dropped.

The editor walks the mount ancestry (`mountIsInsideRepeat` /
`collectEnclosingRepeatAliases`, already there for P182). It uses that **one
ancestry list** in two places — never as types:

1. **Guided binding (item/index):** the type list keeps exactly **two** Repeat
   entries — `Item (Repeat)` and `Index (Repeat)` (innermost, the common case).
   A separate small **Scope picker** sits beside the path field; its options are
   **only the enclosing named repeats** (default = innermost). Picking an alias
   sets the binding's `scope`. No clash (you pick, not type), and you **cannot**
   select a scope you are not inside (correct **by construction**).
2. **Composition (reactive):** a `scope("name")` accessor in the reactive scope
   returns the named frame's item — `scope("customer").name`. Monaco autocompletes
   the name from the **same** enclosing-alias list (mirroring the `store("…")`
   completion); a static `scope("…")` whose name is **not** an enclosing alias
   raises the soft reference warning (mirroring the `store("…")` validation). This
   is the "as a variable" path, namespaced via `scope(…)` so it never collides
   with the built-ins (`store`/`query`/`routeParam`/`item`/`index`).

Generic `item`/`index` (innermost) and unnamed enclosing repeats are unchanged.

#### Original §3 (superseded)

> The editor … offers each [enclosing alias] as a binding type (e.g.
> "customer (Repeat)"), one entry per enclosing named repeat. — **dropped**: type
> list bloat; names are not types.

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
