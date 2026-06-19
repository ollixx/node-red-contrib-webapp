---
id: P190
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat items-Round-trip-Bug: typedInput liegt auf #node-input-items (= Property-id) statt auf separatem Träger → Node-RED auto-clobbert das Binding-Objekt, beim Wieder-Öffnen nicht angezeigt"
findings:
  - "Owner (2026-06-19): 'ui-repeat ist buggy. Ich habe zwei mal einen JSON Wert als Repeat items eingegeben. Beim Neuaufruf des Editors werden die nicht mehr angezeigt. Der Wert ist aber noch in den properties.'"
  - "Code-Befund: nodes/view/ui-repeat.html legt den items-typedInput auf #node-input-items — die GLEICHE id wie die Property `items` (Kommentar: 'so the minimal-coverage E2E check passes'). ui-list (P171) macht es richtig: typedInput auf #node-input-itemsBinding, Property `items` OHNE passendes DOM-Feld, damit Node-REDs Auto-Feld-Handling das Binding-Objekt nicht überschreibt. Durch die id-Kollision schreibt Node-RED den rohen typedInput-Wert (JSON-String) in this.items; beim Wieder-Öffnen kann parseBindingValue diesen rohen String nicht als Binding lesen → readValueBinding liefert leer → Feld bleibt leer, obwohl 'etwas' in den Properties steht."
acceptance:
  - "items-typedInput liegt auf einem SEPARATEN Träger #node-input-itemsBinding (Default `itemsBinding: ''`); die Property `items` (value:null) hat KEIN passendes DOM-Feld — Node-RED kann sie nicht auto-clobbern. Spiegel zu ui-list (P171)."
  - "Round-trip JSON-Literal: ein als `json`-Literal eingegebenes Array (z. B. `[\"a\",\"b\"]` oder `[{\"name\":\"x\"}]`) wird gespeichert UND beim Wieder-Öffnen wieder im Feld angezeigt (Typ `json`, Wert = JSON-String)."
  - "Round-trip gilt auch für die Binding-Typen (store/state/query/…): Wert + Typ kommen beim Wieder-Öffnen korrekt zurück."
  - "Die minimal-coverage-E2E-Erwartung (die ursprünglich zu #node-input-items führte) wird sauber erfüllt — ohne die id-Kollision wieder einzuführen (wie ui-list gelöst)."
  - "Bestehende gespeicherte ui-repeat-Flows mit korrektem items-Binding öffnen unverändert; ein durch den Bug bereits verkorkster roher Wert wird best-effort migriert oder zumindest nicht schlimmer."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: in_progress
---
# P190 — ui-repeat items-Round-trip (Träger-id-Fix)

> **Bug.** `items` round-trippt nicht: der typedInput teilt sich die id mit der
> Property (`#node-input-items`), Node-RED auto-überschreibt das Binding-Objekt
> mit dem rohen Feldwert, und beim Wieder-Öffnen ist nichts mehr da. Fix = das
> bereits bewährte **ui-list-Muster (P171)** übernehmen.

## Kern des Fixes

In `nodes/view/ui-repeat.html`:
- **Default** `itemsBinding: { value: "" }` ergänzen; `items: { value: null }`
  bleibt — **ohne** passendes `#node-input-items`-DOM-Feld.
- **Template:** `<input id="node-input-items">` → `id="node-input-itemsBinding">`.
- **oneditprepare/oneditsave:** den typedInput auf `#node-input-itemsBinding`
  führen (lesen via `parseBindingValue(this.items)`/`readValueBinding`, schreiben
  via `applyValueBinding` nach `this.items`) — exakt wie ui-list (P171).
- **minimal-coverage-E2E:** so erfüllen, wie ui-list es tut (kein Rückfall auf die
  id-Kollision).

## acceptance / verify

- `verify: browser` — JSON-Literal eingeben → speichern → Editor erneut öffnen →
  Wert ist da. E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]); Regression in
  `tests/e2e/nodes/view/ui-repeat.spec.ts`.

## Risiken / Hinweise

- **Audit-Nebenpunkt:** prüfen, ob weitere Knoten denselben id-Kollisions-Fehler
  haben (typedInput direkt auf `#node-input-<property>` statt `*Binding`-Träger) —
  ggf. separat melden/fixen. ui-list ist die Referenz.
- Reine Editor-Verdrahtung — **kein** Schema-/Renderer-Wechsel.
