---
id: P185
node: ui-repeat
epic: nodes/ui-repeat
title: "item/index in Reactive-Expressions erreichbar machen: innerhalb eines ui-repeat exponiert die Reactive-Auswertung globale `item`/`index` (analog `prop` in Component-Def) + Autocomplete"
findings:
  - "Owner (2026-06-14): 'Kann ich das item / den index in reactive erreichen? Da braucht man dann neben routeParams auch eine globale item / index variable.'"
acceptance:
  - "Eine Reactive-Expression an einem Kind INNERHALB eines ui-repeat kann `item` (ganzes Element) bzw. `item.<feld>` und `index` (nullbasiert) lesen — sie liefern den Wert der jeweiligen Instanz."
  - "Außerhalb eines Repeats sind `item`/`index` in der Reactive-Expression `undefined` (konsistent mit der item/index-Binding-Regel) — kein Crash."
  - "prop ist analog innerhalb einer ui-component-Definition in Reactive erreichbar (`prop`, `prop.<feld>`)."
  - "Reactive-Autocomplete (REACTIVE_GLOBALS / der Monaco-Provider) bietet im Repeat-/Component-Scope `item`, `item.` und `index` an (im Doc-Panel erwähnt)."
  - "Per-Instanz-Korrektheit: in einem Repeat mit n Instanzen liefert dieselbe Reactive-Expression je Instanz den eigenen item/index-Wert (Beweis: Liste mit unterschiedlichen Werten je Zeile)."
verify: browser
spec: docs/nodes/concepts/reactive-expressions.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: [P184]
status: done
---
# P185 — item/index in Reactive-Expressions

> Heute exponiert die Reactive-Auswertung nur `routeParam`/`store(...)` etc.
> (`REACTIVE_GLOBALS`). Der Owner will im Repeat zusätzlich `item`/`index` — die
> Render-Zeit-Scope-Werte — auch in einer Reactive-Expression nutzen.

## Kern-Designfrage (vor Umsetzung klären)

Reactive-Expressions werden **client-seitig** ausgewertet (ADR 0010), die
Repeat-Expansion passiert **server-seitig** im Renderer (P164, Klon je Item). Für
eine Reactive-Bindung *innerhalb* einer Instanz muss der **Per-Instanz-`item`/
`index`** in den Auswertungs-Kontext dieser Instanz gelangen. Mechanik festlegen:
der Renderer **injiziert** die Instanz-Werte in den Reactive-Eval-Scope des Klons
(z. B. als zusätzliche gebundene Locals neben den globalen Quellen). Analog `prop`
aus dem `propScope` (P178). Keine globale, instanz-übergreifende Variable — der
Scope ist **pro Instanz**.

## Umfang

1. **Eval-Scope erweitern:** im Repeat-/Component-Scope `item`/`index` (bzw.
   `prop`) als Locals in die Reactive-Auswertung geben; außerhalb → `undefined`.
2. **Autocomplete:** `REACTIVE_GLOBALS`/der Completion-Provider bietet `item`,
   `item.<feld>`, `index` (scope-abhängig, vgl. [[P182]]-Gating-Logik).
3. **Doku:** `reactive-expressions.md` um `item`/`index`/`prop` (scope-lokal)
   ergänzen.

## acceptance / verify

- `verify: browser` — Reactive `` `Zeile ${index}: ${item.name}` `` in einem
  Repeat rendert je Zeile korrekt; E2E im Haupt-Checkout durch den Orchestrator.

## Risiken / Hinweise

- **Hängt an P184** (whole-`item`/`index`-Bindings müssen erst sauber sein).
- Falls die Client-Auswertung die Instanz-Werte nicht sauber bekommt, ist das ein
  **ADR-würdiger** Punkt (Reactive × Render-Zeit-Scope) — dann zurückmelden statt
  raten.
- Scope-Gating der Anzeige folgt [[P182]] (item/index/prop nur im passenden Scope).

## Result

- **delivered:** `item`/`index`/`prop` are now reachable inside **reactive expressions** with correct
  per-instance scope. (1) Renderer: `evaluateReactiveExpression` binds `item`/`index`/`prop` as locals,
  and the `reactive` case in `renderer.ts` injects the innermost `itemScope`/`propScope` frame — one
  compiled expression yields each clone its own value; outside any repeat/component the names resolve to
  `undefined` (no throw). (2) Editor: autocomplete + the reactive doc-panel offer `item`/`index` (in a
  `ui-repeat`) and `prop` (in a `ui-component-definition`) via a new `reactiveScopeGlobals(ctx)`,
  scope-gated through P182's `currentEditorScope()`; `item.`/`prop.` member dots pass through. (3)
  Doc `docs/nodes/concepts/reactive-expressions.md` updated (table + section + example + completion note).
- **stats:** 9 files (6 changed, 3 new); +462/−7. Unit: new `p185-item-index-in-reactive.test.ts`
  (renderer — per-instance resolution + outside-scope undefined) + `p185-reactive-scope-globals.test.ts`
  (editor — scope-gating). Develop verification: build exit 0; full unit green (**renderer 122, editor
  142, runtime 1046**); **ui-repeat E2E 4/4 green** incl. the P185 proof — a reactive
  `${index}: ${item.name}` renders three distinct rows from one expression (fixture
  `ui-repeat-reactive.flow.json`); lint + validate + tripwires OK.
- **notes:** Builds on P184's `itemScope`/`propScope` plumbing (confirmed present before starting).
  Reactive-syntax validation needed no change — `new Function` accepts `item`/`index`/`prop` as free
  identifiers. Stayed within the wave's file ownership (no stores.md/editor.md/playwright/package.json).
- **cost:** session agent-a4ccc553fdfcba33e, ~6m.
