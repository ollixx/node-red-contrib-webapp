---
id: P172
node: ui-list
epic: nodes/ui-list
title: "ui-list: Basis-Felder (P139 / ADR 0015) nachrüsten — visible/disabled/color anwendbar, size N/A (displayType)"
findings:
  - "Owner (2026-06-13): 'Die Base Fields sind auch nicht drin.' ui-list wurde in der P139-Welle übersehen — kein installBaseFields/BASE_FIELDS im HTML."
acceptance:
  - "Gruppe Allgemein mit Basis-Feldern wird in ui-list injiziert (idempotent), mit Überschrift; analog der P139-Referenzknoten."
  - "visible (anwendbar): Boolean-Zustand-typedInput, blendet die Liste ein/aus."
  - "disabled (anwendbar): sperrt die Zeilen-Interaktion (itemClick/itemSelect); ohne aktive Events wirkungslos (Hinweis)."
  - "color (anwendbar, non-variant): aktiver Wert-typedInput; Literal-Farbe roundtrippt als Binding-Objekt."
  - "size (N/A, Erweitert): Feld disabled mit Hinweis, dass die Dichte über displayType (default/divided/compact) gesteuert wird."
verify: browser
spec: docs/nodes/display/ui-list.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: [P171]
status: pending
---
# P172 — ui-list: Basis-Felder nachrüsten

> Rüstet die in der P139-Welle übersehenen Basis-Felder (ADR 0015) an ui-list nach.
> Setzt auf **P171** auf (selber HTML-Editor; vermeidet Datei-Kollision).

## Umfang

- `installBaseFields`/`applyBaseFields` + `BASE_FIELDS` in
  `nodes/view/ui-list.html` verdrahten, mit der Anwendbarkeit aus der Spec
  (Abschnitt „Basis-Felder"):
  - **`visible`** anwendbar, **`disabled`** anwendbar (Zeilen-Interaktion),
    **`color`** anwendbar (non-variant), **`size`** N/A (Hinweis: `displayType`
    steuert die Dichte).
- Editor-Unit (`packages/editor/test`) + E2E (`tests/e2e/nodes/editor/
  base-fields.spec.ts`-Muster) wie bei den Referenzknoten.

## acceptance / verify

- `verify: browser` — wie bei den übrigen P139-Knoten; E2E im Haupt-Checkout.

## Risiken / Hinweise

- `resources/lib/editor-common.js` ist die **einzige kanonische Kopie** der
  Editor-Helfer — keine `lib/`-Duplikate anlegen.
