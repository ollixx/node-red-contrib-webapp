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
status: done
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

## Result

- **delivered:** Retrofitted the P139/ADR-0015 base fields onto ui-list (missed in the P139 wave),
  mirroring the ui-divider reference node. `nodes/view/ui-list.html` wires `installBaseFields`/
  `applyBaseFields` + `BASE_FIELDS` with applicability: **visible** applicable (boolean-state
  typedInput, blends the list), **disabled** applicable (locks itemClick/itemSelect row
  interaction; no-op without active events → hint), **color** applicable (non-variant value
  typedInput; literal colour round-trips as a binding object), **size** N/A (Erweitert, disabled +
  hint that density is via `displayType`). Schema gained visible/disabled/color on ui-list; editor
  mapper passes binding objects through; webapp.js adds a **generic `visibleIf` extraction** on the
  p16Kind path (component.visible → ComponentDefinition.visibleIf) + colorBinding routing for the
  `list` kind; serializer applies disabled (aria-disabled + class) and color (inline CSS on the
  ul).
- **stats:** 8 files (+288/−4); +9 editor unit (`p172-list-base-fields.test.ts`) + 6 base-fields
  E2E; ui-list minimal-coverage entry updated to
  `["name","mount","visibleBinding","disabledBinding","colorBinding","size"]`. Unit green (editor
  117 / renderer 103 / runtime 983). Develop verification: `pnpm build` exit 0; **50/50 green** —
  base-fields.spec (incl. ui-list group + visible/disabled/color/size + colour round-trip) +
  ui-list view + minimal-coverage + ui-divider (cross-check of the generic visibleIf change). No
  regression. check:roadmap + check:links + lint OK.
- **notes:** The generic `visibleIf` extraction is a forward-compatible improvement that gives ALL
  P139-wave nodes working `visible` binding at render time (e.g. ui-divider now honours it too) —
  verified ui-divider stays green. Single-select (`itemSelect`/selectable/selectedId) is **P173**,
  the last open phase. Reused the shared editor helpers (no lib/ duplicate).
- **cost:** session aee7b8c767936b343, ~45m (+ orchestrator develop verification on the slow host).
