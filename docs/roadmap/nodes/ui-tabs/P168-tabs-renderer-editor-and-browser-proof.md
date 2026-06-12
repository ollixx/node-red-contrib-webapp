---
id: P168
node: ui-tabs
epic: nodes/ui-tabs
title: "ui-tabs/ui-tab Renderer + Editor: Slot pro Kind, activeTab per Kind-id, Mount-Tree zeigt ui-tab, Eindeutigkeits-Validierung; Browser-Beweis"
findings:
  - "Owner-Idee (2026-06-12): Jedes Kindelement ist ein Slot, der so heißt wie das Kind; die Tabs werden NICHT über die Editor-Option festgelegt."
  - "Owner (2026-06-12): rechts erscheinen nicht die Slots, sondern der Hinweis — Mounten in ui-tabs heißt 'werde ein Tab'."
acceptance:
  - "ui-tab ist im Editor anlegbar (label/icon/order + Mount in ein ui-tabs); ui-tabs-Editor hat KEIN tabs-JSON-Feld mehr."
  - "Mount-Tree (ADR 0014/P135): ui-tabs erscheint als Drop-Ziel für ui-tab; ein ui-tab erscheint als Container mit Default-Slot für seinen Inhalt."
  - "Renderer: ui-tabs rendert genau einen Slot je ui-tab-Kind; der aktive Tab (activeTab = Kind-id) ist sichtbar, die übrigen ausgeblendet; tabChange emittiert die Kind-id."
  - "Eindeutigkeit: zwei ui-tab-Kinder mit gleichem Namen/gleicher id → sichtbarer Editor-/Deploy-Fehler."
  - "End-to-End (browser): ein ui-tabs mit zwei ui-tab-Kindern (je ein ui-text) rendert zwei Tabs; Tab-Wechsel zeigt den jeweiligen Inhalt; activeTab-Store-Roundtrip funktioniert."
verify: browser
spec: docs/nodes/navigation/ui-tabs.md
tests: tests/e2e/nodes/view/ui-tabs.tests.md
dependencies: [P167]
status: pending
---
# P168 — ui-tabs/ui-tab Renderer + Editor + Beweis

> Zweite Schicht von ADR 0018. Setzt auf das Schema (P167) auf, schließt mit dem
> **browser**-Beweis ab.

## Umfang

1. **Renderer:** ein Slot pro `ui-tab`-Kind; aktiver Tab (`activeTab` = Kind-id)
   sichtbar, Rest aus; `tabChange` emittiert die Kind-id; keyed nach Kind-id.
2. **Node-Registrierung `ui-tab`** (`nodes/.../ui-tab.{js,html}`) + Eintrag in
   `node-red.nodes`/`webapp.js`.
3. **Editor ui-tabs:** `tabs`-JSON **raus**; ui-tabs ist Container für `ui-tab`;
   Mount-Tree zeigt ui-tabs als Drop-Ziel + jedes ui-tab als Container.
4. **Editor ui-tab:** `label`-typedInput, `icon`, `order`, Mount-Picker.
5. **Validierung:** Eindeutigkeit der Kind-id/-Namen mit sichtbarer Fehlermeldung.
6. **Spec/Doku:** `docs/nodes/navigation/ui-tabs.md` auf das Kinder-Modell
   umschreiben; **neues** `docs/nodes/navigation/ui-tab.md` anlegen; Testkatalog
   befüllen.

## acceptance / verify

- `verify: browser` — jede acceptance-Zeile im laufenden Frontend beweisen
  (`preview_*`/Playwright). E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]; Build vor E2E,
  [[e2e-verify-build-and-no-tail]]).

## Risiken / Hinweise

- **Migration** (P167-Mapping) im Editor anwenden, damit alte Flows nicht brechen.
- Dynamische Tabs (ui-repeat → ui-tab) sind **nicht** hier — das ist P170.
