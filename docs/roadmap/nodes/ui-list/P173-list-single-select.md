---
id: P173
node: ui-list
epic: nodes/ui-list
title: "ui-list: Single-Select — selectable + selectedId (zweiseitig) + Selected-Zustand + itemSelect-Event"
findings:
  - "Owner-Review (2026-06-13): itemSelect setzt einen 'Auswahl-Modus' voraus, den es nirgends gibt (kein selectable/selectionMode), und liefert dieselbe Payload wie itemClick → ununterscheidbar. Multi-Select steht zugleich als offener Punkt."
  - "Owner-Entscheidung (2026-06-13): minimales Single-Select jetzt — Feld selectable + selectedId-Binding (zweiseitig, Store) + visueller Selected-Zustand; itemSelect feuert bei Auswahlwechsel. Multi-Select bleibt offener Punkt."
acceptance:
  - "selectable (Checkbox, Default false) schaltet Single-Select ein: Klick auf eine Zeile markiert sie sichtbar als ausgewählt; bei false kein Auswahl-Zustand."
  - "selectedId (zweiseitiges Binding, analog activeTab): liest die ausgewählte id aus dem gebundenen Store/State und schreibt sie beim Auswahlwechsel zurück; ungültige/leere id → keine Zeile markiert."
  - "itemSelect-Event feuert NUR bei selectable UND Auswahlwechsel; params {rowId,row} + clientId/sourceId/appId. Ohne selectable wirkungslos."
  - "Roundtrip (browser): externe Store-Änderung markiert die passende Zeile (SSE-Re-Render); Klick auf eine andere Zeile aktualisiert den Store über selectedId."
verify: browser
spec: docs/nodes/display/ui-list.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: [P171]
status: pending
---
# P173 — ui-list: Single-Select

> Löst den Review-Widerspruch W1 (itemSelect ohne Auswahl-Modell). Setzt auf
> **P171** auf (items/Item-Schema müssen stehen, damit `id` als Auswahl-Anker
> trägt). Multi-Select bleibt bewusst ausgeklammert (offener Punkt der Spec).

## Umfang

1. **`selectable`** (Boolean-Checkbox, Default `false`) — schaltet Single-Select.
2. **`selectedId`** — zweiseitiges Binding auf die `id` der ausgewählten Zeile
   (analog `activeTab` bei ui-tabs, P155): liest aus Store/State, schreibt beim
   Wechsel zurück. Nur relevant bei `selectable`.
3. **Selected-Zustand** im Renderer: die Zeile mit `id == selectedId` wird
   sichtbar markiert; ungültige id → keine Markierung.
4. **`itemSelect`-Event:** feuert bei Auswahlwechsel (nur bei `selectable`);
   `params {rowId,row}` + Standardfelder.

## acceptance / verify

- `verify: browser` — Roundtrip + Selected-Zustand im laufenden Frontend beweisen;
  E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Keine** id am Item → Auswahl per Array-Index als Fallback-`rowId`; eine stabile
  `id` ist für verlässliche Auswahl dringend empfohlen (Doku-Hinweis).
- Multi-Select (Set-Binding statt `selectedId`) ist **nicht** hier — offener Punkt.
