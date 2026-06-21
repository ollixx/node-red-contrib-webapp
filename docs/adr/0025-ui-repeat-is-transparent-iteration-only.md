# ADR 0025: ui-repeat is transparent — iteration only; layout/chrome belongs to ui-container

- Status: accepted
- Date: 2026-06-20
- Reverses: the "ui-repeat as a full container" direction of **P191** (repeat owns a
  content-slot layout) and **P197** (repeat carries a `variant`), and the ui-repeat
  half of **P199** (repeat `variant=span`).
- Builds on: [ADR 0017](0017-ui-repeat-template-container-render-time-scope.md)
  (ui-repeat is chrome-less, a render-time template). Keeps: P164 (n× expansion),
  P184/P185 (item/index bindings + reactive), P192 (scope through nested containers),
  P193/P196 (named scopes + scope picker / `scope()` accessor).

## Context

The owner's requirement, stated plainly: *a `ui-repeat` should render its children
N times as tight, contiguous inline texts — no wrapper per item.* (`„ein repeat
horizontal so bauen, dass die elemente dahinter auch wirklich dicht hintereinander
liegende texte sind. Ohne wrapper der items."`)

P191/P197/P199 had pushed ui-repeat toward being a **container**: its own `layout`
preset, its own `variant`, a per-item container wrapper. The runtime `mapConfig`
even default-migrated the repeat's `layoutId` to `vertical`, so **every** repeat
always took the "render a container per item" path. The rendered DOM for a repeat
was therefore, per item:

```
<div class="webapp-item webapp-item--…">          ← per-item block wrapper (region)
  <div class="webapp-container webapp-container--transparent">  ← repeat-as-container
    <div class="webapp-layout--vertical">…<p class="webapp-text">a</p>…
```

Those per-item block wrappers **stack** — measured positions for three items were
`y = 111, 147, 183` (three rows), never side by side. No `variant=span` CSS could
fix it, because the wrapper that stacks is the per-item region `<div>` the repeat
itself introduced. **The tests passed anyway** — they asserted the wrapper *tag*
(`span.webapp-container--span` ×3) and text content, never the actual *layout*.
Green on tags, wrong on the requirement. This is the core failure the owner named.

## Decision

**`ui-repeat` is transparent. It does exactly one thing: iterate.** It adds no
wrapper, no own layout, no variant. The cloned template children flatten into the
**host region**, re-id'd per instance (`<itemKey>#<childId>`), exactly where the
repeat sat. `layout` and `variant` are **removed** from the ui-repeat contract
(schema), the editor (no layout selector, no variant SelectBox), and the runtime
(`mapConfig` no longer maps or default-migrates them; the repeat registers no layout).

**Layout and chrome are the job of an explicit `ui-container`** (which already owns
`layout` + `variant`, including `horizontal`/`span` and the per-variant rendering
from P198/P199). Two composition patterns:

- **Container around the repeat** — `ui-container[variant=span]` → `ui-repeat` →
  `ui-text(item)`: the container arranges all N clones. With `span` the three values
  render on **one line, tight** (measured: same `y`, increasing `x`).
- **Container as the repeat's single child** — to group multiple fields per item
  (e.g. name + city per customer) into a card/row, wrap them in a `ui-container`
  inside the repeat. Without it the children flatten (`name1,city1,name2,…`).

## Consequences

- **Leaner markup (KISS, owner follow-up):** even with the repeat transparent, the
  rendered HTML was wrapper-heavy — every child was wrapped in a `<div class="webapp-item">`,
  so a repeat of `ui-text` emitted `div.webapp-item > p` per item (a stack of wrapper
  divs). The serializer now **drops that wrapper for a plain display leaf** (kinds
  `text`/`badge`/`icon`/`image`/`divider`/`avatar`/`progress`/`skeleton`) that has **no
  placement** — `data-webapp-node` is stamped onto the leaf's own element (at the end of
  its open tag, preserving the `<tag class="…"` prefix). The keyed morph keys on
  `[data-webapp-node]` wherever it sits, and the action overlay already resolves
  `closest("[data-webapp-node]")`, so behaviour is unchanged. **Kept wrapped:**
  containers/tabs/accordion/table (they *are* a box; their structural markup is matched
  elsewhere), change-controls (their `data-webapp-source` change plumbing reads the
  wrapper), and anything with grid/absolute placement (the wrapper carries the placement
  style). Measured: the span subtree for a 3-item repeat of `ui-text` went from 9 to 6
  descendant elements; the three `<p>` are now direct, attribute-stamped leaves.
  *Stage 2 (collapsing the `layout`/`slot`/`slot-body` wrappers in the single-slot case)
  is deliberately NOT done here — higher CSS risk, separate decision.*
- **Trade-off (accepted by the owner):** multiple children per item are NOT
  auto-grouped — grouping requires an explicit inner `ui-container`. Less "magic",
  but unambiguous: the flow shows exactly which node produces which box.
- The renderer `expandRepeat` loses its per-item container branch; it always flattens
  (the legacy P164 path). The P192 child-bearing-subtree handling stays for the case
  of a real `ui-container` *inside* a repeat.
- Removed: `ui-repeat.layout` / `ui-repeat.variant` (schema), the layout selector +
  variant SelectBox (editor), the `layoutId`/`variant` mapping + layout registration
  (runtime). Tests that asserted the old container behaviour (renderer `p191`/`p197`,
  schema `p197`, the P191/P197/P199-repeat E2E + fixtures) are removed.
- **Verification rule going forward:** layout requirements are asserted by
  **measurement** (bounding boxes: same row = same `y`, left-to-right = increasing
  `x`, no per-item wrapper element), never by tag/class alone. The new E2E proof
  (`ui-repeat is transparent … ADR 0025`) measures the owner's exact case green.
- ui-container variants (P198 + the ui-container half of P199, incl. `span`) are
  unaffected — they live on ui-container, where they belong.
