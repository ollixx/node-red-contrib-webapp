---
id: P207
node: aspects/layout
title: "order-Default = Canvas-y: jeder Knoten mit leerem `order` übernimmt seine Node-RED-Canvas-y-Position als Reihenfolge (visuelle Anordnung = gerenderte Anordnung)"
epic: aspects/layout
findings:
  - "Owner (2026-07-10): 'alle knoten mit Order Feld übernehmen ihre y position, wenn kein wert eingegeben wurde.'"
  - "Owner (2026-07-10) zur Misch-Semantik: 'mischen ist ok' — d. h. literal: ein explizit gesetztes `order` sortiert VOR den y-Fallback-Knoten (kleine Zahl < großer y-Pixelwert); keine Sonderbehandlung bei gemischten Slots."
  - "Code-Befund: jeder order-tragende Knoten mappt `order: toOptionalNumber(config.order)` (nodes/webapp.js, ~10 Stellen: ui-text/button/input/select/checkbox/switch/textarea/slider/radio/datepicker/badge/image/… — die view-Knoten mit order). Renderer (packages/renderer/src/renderer.ts:1172-1173) und Registry (packages/runtime/src/registry.ts:169-170) sortieren `order ?? Number.MAX_SAFE_INTEGER` (leer ⇒ ans Ende, stabile Einfügereihenfolge). Die Canvas-y (`config.y`) ist im mapConfig-Input beider Pfade vorhanden (Deploy: `entry` @2795; Runtime: `config` @4521 — rohe Flow-/RED-Knoten)."
acceptance:
  - "Zentraler Helper (nodes/webapp.js): eine Funktion `resolveOrder(config)` = `toOptionalNumber(config.order) ?? toOptionalNumber(config.y)`. ALLE mapConfigs, die heute `order: toOptionalNumber(component.order)` setzen, nutzen stattdessen `order: resolveOrder(component)`. Kein order-tragender Knoten bleibt auf dem alten Ausdruck."
  - "Browser (E2E, gemessen): zwei order-tragende Knoten im selben Slot OHNE gesetztes order rendern in Canvas-y-Reihenfolge (der mit kleinerem y steht im DOM zuerst) — belegt per Bounding-Box/DOM-Reihenfolge, nicht per Tag. Vertauschen der y-Werte im Flow vertauscht die gerenderte Reihenfolge."
  - "Explizites order gewinnt weiterhin: ein Knoten mit gesetztem `order` behält exakt diesen Sortierschlüssel. Misch-Fall (literal): Knoten A `order=5`, Knoten B leer bei `y=120` ⇒ A vor B (5 < 120). Per E2E belegt und in der Doku als erwartetes Verhalten festgehalten."
  - "Kein Bruch: Slots, in denen ALLE Knoten explizite order haben, rendern unverändert. Der Renderer/Registry-Sort (`order ?? MAX`) bleibt unangetastet — geändert wird ausschließlich der gemappte Default-Wert von `order`."
  - "Doku (docs/nodes/concepts/layout.md): der `order`-Default ist dokumentiert — leer ⇒ Canvas-y; explizit ⇒ dieser Wert; Misch-Verhalten (explizit sortiert vor y-Fallback) erklärt. Die per-Node-`order`-Feldbeschreibungen verweisen darauf."
verify: browser
spec: docs/nodes/concepts/layout.md
tests: tests/e2e/layout-apps.spec.ts
dependencies: []
status: pending
---
# P207 — order-Default = Canvas-y (leeres order übernimmt die y-Position)

> Owner-Feature (2026-07-10): die visuelle Reihenfolge der Knoten auf dem
> Node-RED-Canvas soll ohne manuelles `order` die gerenderte Reihenfolge im Slot
> bestimmen.

## Kern

Ein zentraler Helper ersetzt den order-Default in allen order-tragenden
mapConfigs:

```js
function resolveOrder(config) {
    const o = toOptionalNumber(config.order);
    return o !== undefined ? o : toOptionalNumber(config.y);
}
// überall statt: order: toOptionalNumber(component.order)
//            →   order: resolveOrder(component)
```

`config.y` = die rohe Node-RED-Canvas-y (kein `layoutY`; das ist das
Absolute-Layout-Feld und bleibt getrennt). Renderer/Registry sortieren bereits
`order ?? MAX_SAFE_INTEGER`, also greift der y-Fallback ohne Sort-Änderung.

## Misch-Semantik (Owner: „mischen ist ok")

Literal: explizit gesetztes `order` (kleine Zahl) sortiert vor y-Fallback-Knoten
(großer Pixelwert). Keine Slot-weite Umschaltung. In `layout.md` als erwartetes
Verhalten dokumentieren.

## acceptance / verify

- `verify: browser` — die gerenderte Reihenfolge wird **gemessen** (DOM-Reihenfolge
  / Bounding-Box-y), nicht per Tag/Klasse; im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- Unit-Abdeckung für `resolveOrder` (order gesetzt → order; leer → y; beide leer →
  undefined) ist sinnvoll, aber der Beweis ist die gemessene Render-Reihenfolge.

## Risiken / Hinweise

- **Nur** der gemappte Default ändert sich; Sort-Logik, `layoutY` (Absolute-Layout)
  und explizite order bleiben unangetastet.
- Alle order-tragenden view-Knoten erfassen (die vollständige Liste ist die Menge
  der mapConfigs mit `order: toOptionalNumber(component.order)` in nodes/webapp.js)
  — keinen auslassen, sonst inkonsistente Reihenfolge zwischen Knotentypen.
