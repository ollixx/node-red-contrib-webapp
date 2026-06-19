---
id: P191
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat bekommt ein eigenes Layout (layoutId + Child-Layout-Selektor) für seinen content-Slot — konform zu ui-container/ui-route"
findings:
  - "Owner (2026-06-19): 'ui-repeat braucht das Feld Layout. Es ist ein Container und die Kinder referenzieren es als Parent mit Slot content. Das sollte konform zu den anderen Containern sein und Repeat bekommt ein eigenes Layout.'"
  - "Befund: ui-container/ui-route tragen layoutId (required) + installLayoutSelector (#node-input-layoutId + #node-input-layout-preset, Label 'Child Layout'/'Parent Layout') → das Layout-Preset ihres Slots. ui-repeat hat NUR layoutX/Y + installLayoutChildPropRows (seine EIGENE Platzierung als Kind), aber KEIN layoutId für seinen content-Slot (REPEAT_SLOT, container:<id>/content). Die geklonten Kinder bekommen also kein Slot-Layout."
acceptance:
  - "ui-repeat-Schema trägt `layoutId` (wie ui-container) — das Layout-Preset für seinen content-Slot; die App-Layout-Liste enthält das referenzierte Layout."
  - "Editor: ein 'Child Layout'-Selektor (installLayoutSelector, #node-input-layoutId hidden + #node-input-layout-preset) — identisch zu ui-container; Default-Preset wie ui-container."
  - "Runtime/Renderer: die in den content-Slot geklonten Kinder werden gemäß dem gewählten Preset platziert (horizontal/vertical/grid/absolute) — die Child-Placement-Felder (order/row/col/…) der Kinder greifen entsprechend (installLayoutChildPropRows auf Basis des Repeat-Layouts)."
  - "Round-trip: gewähltes Layout speichert + öffnet wieder; ein bestehender ui-repeat ohne layoutId migriert auf das Default-Preset (kein roter Pflichtfeld-Bruch beim Öffnen alter Flows)."
  - "ui-repeat bleibt zugleich Kind: seine layoutX/Y + Placement im PARENT (installLayoutChildPropRows) bleiben unverändert — die zwei Rollen (Kind-Platzierung vs. eigenes content-Layout) sind sauber getrennt."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: in_progress
---
# P191 — ui-repeat: eigenes content-Layout (Container-Konformität)

> Macht ui-repeat zu einem **vollwertigen Container** wie ui-container/ui-route:
> ein **Layout-Preset für seinen `content`-Slot**, sodass die geklonten Kinder
> wie überall platziert werden. ui-container ist die Konformitäts-Vorlage.

## Umfang (mehrschichtig, gespiegelt von ui-container)

1. **Schema:** ui-repeat-Definition um `layoutId` ergänzen (das content-Slot-
   Layout); die App führt das Layout in ihrer `layouts`-Liste.
2. **Editor (`nodes/view/ui-repeat.html`):** `layoutId: { value: "", required:
   true }` + verstecktes `#node-input-layoutId` + `#node-input-layout-preset`-
   Select („Child Layout"); `installLayoutSelector({ valueSelector, presetSelector,
   getInitialId })` — 1:1 wie ui-container.
3. **Runtime/Renderer:** das Repeat-Layout für seinen content-Slot registrieren;
   beim Klonen die Kinder gemäß Preset platzieren (die `installLayoutChildPropRows`
   der Kinder basieren auf dem Repeat-Layout, nicht auf dem Parent des Repeats).
4. **Migration:** alter ui-repeat ohne `layoutId` → Default-Preset (kein
   Pflichtfeld-Rotbruch).
5. **Spec/Tests:** ui-repeat-Spec „Felder" + „Einordnung" um das content-Layout
   ergänzen; E2E: ein Repeat mit grid-/vertical-Layout platziert die Klon-Kinder
   entsprechend.

## acceptance / verify

- `verify: browser` — ein ui-repeat mit gewähltem Layout platziert die geklonten
  Kinder sichtbar gemäß Preset; Round-trip im Editor. E2E im Haupt-Checkout durch
  den Orchestrator ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Zwei Rollen sauber trennen:** ui-repeat als *Kind* (layoutX/Y + Placement im
  Parent, bereits da) vs. ui-repeat als *Container* (neues `layoutId` fürs
  content-Layout) — nicht vermischen.
- Konformität zu ui-container ist der Maßstab; **kein** neues Layout-Modell — die
  bestehenden Presets/`installLayoutSelector` wiederverwenden.
- Hängt nicht hart an P190, berührt aber dieselbe Datei (`ui-repeat.html`) —
  Reihenfolge im Orchestrator beachten.
