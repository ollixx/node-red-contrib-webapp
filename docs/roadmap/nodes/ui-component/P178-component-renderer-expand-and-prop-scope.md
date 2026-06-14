---
id: P178
node: ui-component
epic: nodes/ui-component
title: "ui-component Renderer: expandComponent (Definition-Subtree an Instanz-Mount), prop.<name>-Auflösung gegen propScope, nested + Self-Guard, Re-Id/Keying"
findings:
  - "Owner-Entscheidung (ADR 0020): Expansion = expandComponent, 1:1 modelliert auf expandRepeat (ADR 0017): props auflösen → propScope-Frame pushen → def:<id>/content-Subtree rendern → je Knoten <instanceId>#<innerNodeId> re-id'en → in die Host-Region der Instanz flatten."
  - "ADR 0020: prop ist die erste prop-scope-lokale Art; resolveBinding löst prop.<name> gegen den obersten propScope-Frame auf, exakt wie der item-Fall. Außerhalb einer Instanz → undefined (kein Wurf)."
acceptance:
  - "Eine ui-component-instance mit definitionId=D + props={title:'A'} rendert den def:D/content-Subtree an den outer mount der Instanz; ein Kind mit text=prop.title zeigt 'A'."
  - "Zwei Instanzen derselben Definition mit verschiedenen props rendern verschiedene Werte (prop wird je Instanz gegen den eigenen Frame aufgelöst); die geklonten Knoten tragen eindeutige, stabile Ids <instanceId>#<innerNodeId> (keyed)."
  - "prop.<pfad> löst ein-/mehrstufige Felder eines Objekt-Props auf (prop.user.name); prop (bare) liefert den ganzen Prop-Wert; prop außerhalb einer Component-Instanz → undefined (definiert, kein Crash; fallback/\"?\" wie bei item)."
  - "Die ui-component-definition rendert NICHT eigenständig (kein outer mount → renderRegions emittiert sie nicht direkt); nur expandComponent konsumiert ihren def:-Subtree."
  - "Nested/rekursiv: eine Instanz, deren Definition selbst eine Instanz einer anderen Definition enthält, expandiert rekursiv (props der inneren Instanz gegen ihren eigenen Frame); ein direkter/transitiver Selbst-Bezug (Definition instanziiert sich selbst) wird NICHT endlos expandiert — der Self-Guard bricht ab (kein Hang, definierter Abbruch)."
  - "Reaktiv: eine Änderung eines prop-gebundenen Stores/States erzeugt einen frischen Snapshot mit dem aktualisierten Wert in allen betroffenen Instanzen."
verify: unit
spec: docs/nodes/structure/ui-component.md
tests: tests/e2e/nodes/view/ui-component.tests.md
dependencies: [P177]
status: in_progress
---
# P178 — ui-component Renderer: expandComponent + propScope

> Zweite Schicht von [ADR 0020](../../../adr/0020-component-model-dedicated-ui-component-node.md).
> Der Renderer macht die Instanz-Expansion und löst die neue scope-lokale Binding-
> Art `prop` auf. Setzt auf das Schema (P177) auf und ist **1:1 modelliert auf
> `expandRepeat`** (ADR 0017) — Komposition statt neuem Mechanismus.

## Umfang

1. **`expandComponent`** (`packages/renderer/src/renderer.ts`, modelliert auf
   `expandRepeat`): für jede `ui-component-instance` →
   - die `props`-typedInputs der Instanz auflösen (jede Binding-Art) → **einen
     `propScope`-Frame** `{ <name>: value, … }` bauen;
   - den Frame auf den `BindingSources.propScope`-Stapel pushen (neben `itemScope`);
   - den `def:<definitionId>/content`-Subtree gegen den erweiterten Scope rendern;
   - jeden gerenderten Knoten **`<instanceId>#<innerNodeId>`** re-id'en (das
     `expandRepeat`-`<itemKey>#<childId>`-Rezept);
   - den Subtree in die **Host-Region** der Instanz flatten (der outer `mount` der
     Instanz ist die Brücke, wie der Repeat-Template-Mount);
   - nach der Instanz den Frame poppen.
2. **`prop` / `prop.<name>`-Auflösung** in `resolveBinding`: gegen den obersten
   `propScope`-Frame, exakt der `item`/`index`-Fall. Außerhalb einer Instanz →
   `undefined` (definiert).
3. **Self-Guard / Nested:** verschachtelte Instanzen rekursiv expandieren (wie
   nested repeats); ein `visitedDefinitions`-Guard verhindert die endlose Expansion
   eines direkten/transitiven Selbst-Bezugs (definierter Abbruch, kein Hang).
4. **Definition rendert nie selbst:** `renderRegions` emittiert einen `def:`-
   gewurzelten Subtree nicht direkt (kein realer mount); nur `expandComponent` zieht
   ihn.

## acceptance / verify

- `verify: unit` — Renderer-Snapshot-Tests in `packages/renderer/test` decken jede
  acceptance-Zeile (Expansion, prop-Auflösung pro Instanz, Re-Id/Keying,
  nested + Self-Guard, definition-rendert-nicht, reaktive prop-Änderung). Der
  **browser**-Beweis des Gesamtflusses liegt in P179.

## spec / tests

- spec: `docs/nodes/structure/ui-component.md` (Renderer-Verhalten ergänzen).
- tests: `tests/e2e/nodes/view/ui-component.tests.md` (Renderer-Abschnitt, unit).

## Risiken / Hinweise

- **Leitprinzip Komposition:** so viel wie möglich aus `expandRepeat` + dem
  `itemScope`-Mechanismus wiederverwenden — wenn dieses Paket viel neuen Code
  braucht, stimmt etwas an ADR 0017/0020 nicht → zurückmelden.
- **v1 read-only / presentational:** kein Child-Slot-Projection (P142), kein
  Per-Instanz-State. Nur props rein, Render raus.
