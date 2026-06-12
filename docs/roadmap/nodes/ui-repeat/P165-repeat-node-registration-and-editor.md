---
id: P165
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat Node + Editor: Registrierung, Default-Slot als Template, items-typedInput + keyField; End-to-End-Beweis"
findings:
  - "Owner-Idee (2026-06-11): Ein Knoten ui-repeat mit Default Slot als Container; Kinder binden relativ zum Kontext. Die wiring Lösung: beim Empfangen einer Liste/Object die items rendern."
  - "Owner-Entscheidung (2026-06-12): zwei Knoten — ui-list bleibt das Blatt-Widget, ui-repeat ist das generische Template-Primitiv (Decision A)."
acceptance:
  - "ui-repeat ist im Node-RED-Editor anlegbar und registriert (nodes/view/); items-typedInput (Wert-Bindings) + keyField-Feld + Mount-Picker sichtbar."
  - "Der Default-Slot nimmt Kind-Knoten auf: ein Kind lässt sich in den ui-repeat-Slot mounten (Mount-Picker zeigt den Repeat-Slot)."
  - "Editor bietet die Binding-Art item/index in den typedInputs der Kinder an (oder dokumentierter manueller Weg), und warnt bei item/index-Gebrauch außerhalb eines Repeats."
  - "End-to-End (browser): ein Store-Array [{name:'A'},{name:'B'}] + ui-repeat mit ui-text-Kind (text = item.name) rendert zwei Zeilen 'A','B'; Hinzufügen eines dritten Items rendert sichtbar eine dritte Zeile (keyed, ohne Flackern der ersten beiden)."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: [P164]
status: pending
---
# P165 — ui-repeat Node-Registrierung + Editor

> Dritte Schicht (ADR 0017). Knoten-Registrierung (`nodes/view/ui-repeat.{js,html}`)
> + Editor-UI; schließt die Welle mit dem **browser**-Beweis ab. Setzt auf
> P163 (Schema) + P164 (Renderer) auf.

## Umfang

1. **Registrierung:** `nodes/view/ui-repeat.js` + `.html`, eingetragen im
   `node-red.nodes`-Block und in `nodes/webapp.js` (Config → Schema-Definition,
   Message-Routing wie ui-list: `msg.payload` setzt `items`).
2. **Default-Slot als Template:** der Knoten ist Container-fähig; Kinder mounten in
   seinen Default-Slot (`installReferenceSelectors`/Mount-Picker zeigt den Slot).
3. **Editor-Felder:** `items`-typedInput (Wert-Bindings), `keyField`-Textfeld,
   Mount-Picker, Basis-Felder (P139/ADR 0015 — Anwendbarkeit klären: Container →
   `visible` anwendbar).
4. **item/index im Editor:** die scope-lokale Binding-Art in den Kinder-typedInputs
   anbieten; bei Gebrauch **außerhalb** eines Repeats eine Editor-Warnung
   (deploy-blockierend? — mind. sichtbarer Hinweis).
5. **Beispiel/Doku:** Spec `docs/nodes/display/ui-repeat.md` final mit dem
   gebauten Stand abgleichen; Testkatalog befüllen.

## acceptance / verify

- `verify: browser` — jede acceptance-Zeile im laufenden Frontend beweisen
  (`preview_*` / Playwright). Der End-to-End-Render-Beweis ist die Kern-Zeile.
- E2E-Verifikation **im Haupt-Checkout** durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]; Build vor E2E,
  [[e2e-verify-build-and-no-tail]]).

## Risiken / Hinweise

- **Stufe 1 read-only** — kein Schreiben aus der Zeile (Stufe 2, ADR 0017 §5).
- `examples/customers-crud/flow.json` ist generiert — falls ein Repeat-Beispiel
  aufgenommen wird, nur via `pnpm gen:example`, nie von Hand.
