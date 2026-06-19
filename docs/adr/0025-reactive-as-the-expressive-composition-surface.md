# ADR 0025: reactive (+ JSONata) is the expressive composition surface; simple binding kinds are sugar

- Status: accepted
- Date: 2026-06-19
- Builds on: [ADR 0010](0010-reactive-binding-client-expressions.md) (reactive),
  [ADR 0016](0016-ui-query-trigger-model-visible-no-auto-fire.md) (reads may be
  reactive; side effects must be visible), P185 (item/index in reactive), P193
  (named repeat scopes). Relates to ADR 0017/0020 (scope-local kinds).

## Context

The binding surface has grown many special kinds — `item`/`index`/`prop`, store
sub-path, named scopes. Owner (2026-06-19): wouldn't a single "Repeat" type where
you write `item.…`/`index` be enough — and more broadly, couldn't the binding be
more elegant, JSONata-like, a complex function combining constants and other info,
so that layout nestings and nodes are saved?

The insight: a type where you write `item.name` **or** `index` **is** a reactive
expression. With P185, `item`/`index`/`prop` (and named scopes, P193) become
**locals in the reactive scope** — so one reactive binding already expresses all
of it, plus constants, arithmetic and conditionals:
`` `${index + 1}. ${item.name} (${item.price} €)` ``.

## Decision

### 1. Reactive / JSONata = the composition surface

For **composed or computed display values**, a single **reactive** expression
(client) — or **JSONata** (message-driven) — is the canonical surface. It reads
all scope locals (`state`/`store`/`query`/`routeParam`/`item`/`index`/`prop`/named
scopes) and combines them with **constants and computation**. This is the
"complex function" the owner asked for.

### 2. The simple kinds are discoverability SUGAR, not a separate mechanism

`Item (Repeat)`, `Index (Repeat)`, `Store`, … stay as **guided, validated**
shortcuts for the common single-value case (a picker + path field + autocomplete).
They are **sugar over** what reactive can already express — kept deliberately,
because free-text expressions are error-prone for the 80% case (the owner just hit
"typed `item` → `?`"). We do **not** merge `item`/`index` into one new type;
reactive already **is** the unified expressive type once P185 lands.

### 3. Saves value-composition nodes — NOT visual layout

A reactive `` `${index+1}. ${item.name}` `` replaces "two `ui-text` + a container
to show `1. Ada`" → fewer nodes. But it does **not** replace **visual-layout**
nesting: a grid of cards still needs `ui-repeat` + a container with a grid layout.
**Value/text composition** collapses into an expression; **structural layout** does
not. Keep the two concerns distinct in docs and UX.

### 4. Boundary: composition is a READ

Reactive composition is **read-only** (ADR 0016): it computes a display value, no
side effect. Writing/triggering stays visible (wires / declared references). The
expression surface does not become a place to mutate state.

## Consequences

- **P185** (item/index in reactive) is the enabler; **P193** (named scopes)
  extends it. Once both land, **re-evaluate** whether any simple kind is now pure
  redundancy (likely keep them as sugar; retire only true dead weight).
- Docs position reactive as the composition tool, with worked examples
  (`reactive-expressions.md`), and state the value-composition-vs-layout boundary.
- No new mechanism here — this is a **direction + principle**; the implementation
  is the reactive-scope work (P185/P193). A later package may add editor ergonomics
  (e.g. "compose" affordance) but is not required.
- Reinforces "reads may be reactive, side-effects must be visible" (ADR 0016).
