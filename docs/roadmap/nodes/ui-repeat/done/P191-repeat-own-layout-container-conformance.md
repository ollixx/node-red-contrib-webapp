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
status: done
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

## Result

- **delivered:** `ui-repeat` now owns a **content-slot layout** conforming to `ui-container`/`ui-route` —
  a `layoutId` + a "Child Layout" preset selector. Schema gains the optional `layout` preset
  (`packages/schema/src/node-definitions.ts`); the editor (`nodes/view/ui-repeat.html`) gets the hidden
  `#node-input-layoutId` + `#node-input-layout-preset` selector via the existing `installLayoutSelector`
  (1:1 with ui-container); `nodes/webapp.js` maps the chosen preset into `props.layoutId` and registers
  the repeat's layout in the model's `layouts` list; the renderer (`expandRepeat`) renders one
  `container`-kind component per item (`<itemKey>#<repeatId>`) wrapping the cloned children in the
  layout's regions, **reusing** `cloneTemplateSubtree` + `createContainerMountMatcher` +
  `standardLayoutPresets` (consumed, not reimplemented). No-layoutId keeps the legacy P164 flat path
  (p164/p192 untouched); a legacy repeat default-migrates to `vertical` and opens green.
- **stats:** 10 files (8 changed, 2 new — renderer unit `p191-repeat-own-layout.test.ts` + fixture
  `ui-repeat-layout.flow.json`). Develop verification: build exit 0; full unit green (schema 364,
  editor 152, renderer **141** incl. 5 new P191, runtime 1049); `check:specs` green (ui-repeat still
  allowlisted); **ui-repeat E2E 9/9 green** incl. both P191 layout proofs (per-item container under the
  chosen grid layout with the `--grid` slot-body modifier; cloned children resolve `item.*` per row);
  lint + validate + tripwires OK.
- **notes:** **Orchestrator follow-up fix** (`phase/P191`, `nodes/webapp.js` only) — the first cut
  passed the renderer unit test but the authoritative E2E showed the per-item container always rendered
  with `--vertical`, never the chosen `--grid`. Root cause: the ui-repeat `mapConfig` never copied the
  layout preset into the definition (unlike ui-container's `layout: config.layoutId`), so `buildAppSnapshot`
  read `component.layout` as undefined and default-migrated every repeat to `vertical`. The renderer,
  fixture, and test selector were all correct; only the config→definition mapping dropped it. Fixed with
  one line (`layout: config.layoutId || config.layout`). The renderer unit test missed it for the same
  reason as P192 — it hand-builds the model, skipping `mapConfig`. **Follow-up:** P195's `check:specs`
  allowlists ui-repeat ("reconcile after P190/P191/P193") — once **P193** lands, make the ui-repeat spec
  field-table conformant and drop it from the allowlist.
- **cost:** session agent-a28d7f7c7830c0d30 (~28m) + fix session aec02c65df459d313 (~7m).
