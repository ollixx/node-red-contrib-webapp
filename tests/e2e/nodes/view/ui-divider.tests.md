# Testkatalog: ui-divider

> Format gemäß `.ai/agents/node-testing.md`. Aktualisiert im Konformitäts-Pass
> P230 (node-conformance). Editor-Base-Field-Coverage liegt in
> `tests/e2e/nodes/editor/base-fields.spec.ts` (nicht dupliziert).

## Feature-Tests (`ui-divider.spec.ts`)

| Test | Testziel |
|---|---|
| horizontal → `<sl-divider>` ohne `vertical` | Orientation horizontal gerendert |
| vertical → `<sl-divider vertical>` | Orientation vertical gerendert |
| Literal-Label mittig im Divider | `label`-Literal wird angezeigt |
| Store-gebundenes Label → aufgelöster Live-Wert (P150) | `label`-Binding wird vom Renderer aufgelöst und gerendert |
| kein Input-/Output-Port (statisches Blatt) | ui-divider ist ein statischer Leaf-Knoten (P76) |

## Blockiert durch P231 (`test.fixme`)

Base-Fields `visible`/`color` fehlen im ui-divider-**Schema** → Zod strippt sie →
zur Laufzeit wirkungslos. Systemischer Fix: **P231**. Nach P231 ent-fixmen:

| Test (fixme) | Testziel |
|---|---|
| gebundenes `color` → `sl-divider style="--color:…"` | Base-Field color emittiert die Shoelace-`--color`-Property |
| `--color` am gerenderten Element (computed style) | color wirkt auf die Linie (gemessen) |
| `visible` an Store=false → nicht gerendert | Render-Gate blendet aus (ADR 0037) |
| `visible` an Store=true → gerendert | Render-Gate zeigt an |

## Hinweise

- Platzierung (order/row/col) ist generisches Layout-Boilerplate — abgedeckt von der
  Layout-Suite, nicht pro Knoten (node-testing.md: Suite schlank halten).
