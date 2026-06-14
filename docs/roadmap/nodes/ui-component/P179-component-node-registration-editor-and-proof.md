---
id: P179
node: ui-component
epic: nodes/ui-component
title: "ui-component Node + Editor + Runtime-Bucketing + Browser-Beweis: definition/instance registrieren, Editor (def-Slot, definitionId-Picker, props-Map), End-to-End"
findings:
  - "Owner-Entscheidung (ADR 0020): die zwei Knotentypen werden registriert; getDefinitionBuckets + WEBAPP_NODE_TYPES lernen sie; die Definition-Kinder bucketen über ihr reales .z in die App (kein Subflow-.z-Problem)."
  - "ADR 0020: Editor — Definition ist ein Container mit Default-Slot; Instanz hat einen definitionId-Picker (Referenz-Selektor) + eine props-Map aus typedInputs (jede Binding-Art)."
  - "ADR 0020 v1-Cut: props rein / events raus (Instanz-Identität <instanceId>#<innerNodeId>); KEIN Child-Slot-Projection (P142), KEIN Per-Instanz-State."
acceptance:
  - "ui-component-definition und ui-component-instance sind im Node-RED-Editor anlegbar und registriert (nodes/...{js,html}, node-red.nodes-Block, nodes/webapp.js mapConfig + getDefinitionBuckets + WEBAPP_NODE_TYPES)."
  - "Editor Definition: Container-fähig — ein Kind lässt sich in den Default-Slot der Definition mounten (Mount-Picker/-Tree zeigt die Definition als Container mit Slot); die Definition hat keinen outer-mount-Zwang (off-canvas, rendert nicht selbst)."
  - "Editor Instanz: ein definitionId-Picker listet vorhandene ui-component-definition-Knoten und referenziert eine; eine props-Map erlaubt name→Wert-typedInput-Paare (Hinzufügen/Entfernen), jede Binding-Art; outer Mount-Picker wie jeder gemountete Knoten."
  - "Eindeutigkeits-/Self-Ref-Validierung sichtbar: eine Instanz ohne gültige definitionId und ein Definition-Selbstbezug ⇒ sichtbarer Editor-/Deploy-Fehler (P177-Validierung an die Oberfläche gebracht)."
  - "End-to-End (browser): eine Definition mit zwei ui-text-Kindern (text = prop.title bzw. prop.body); zwei Instanzen mit verschiedenen props an verschiedenen Mounts rendern jeweils ihre zwei Zeilen mit den instanz-spezifischen Werten; ein prop-an-Store-Binding aktualisiert die betroffene Instanz live; ein Event eines inneren Knotens trägt die Instanz-Identität (<instanceId>#<innerNodeId>) im rowId/sourceId."
  - "Bestehende E2E (ui-repeat/tabs/list etc.) bleiben grün; die zwei neuen Node-Typen brechen das Editor-Laden nicht (minimal-coverage)."
verify: browser
spec: docs/nodes/structure/ui-component.md
tests: tests/e2e/nodes/view/ui-component.tests.md
dependencies: [P178]
status: in_progress
---
# P179 — ui-component: Node-Registrierung + Editor + Beweis

> Dritte Schicht von [ADR 0020](../../../adr/0020-component-model-dedicated-ui-component-node.md).
> Knoten-Registrierung + Editor-UI + Runtime-Bucketing; schließt die Welle mit dem
> **browser**-Beweis ab. Setzt auf P177 (Schema) + P178 (Renderer) auf. Mustervorlage:
> die ui-repeat-Registrierung (P165) + der Referenz-Selektor (P114/P60).

## Umfang

1. **Registrierung beider Knoten:** `nodes/.../ui-component-definition.{js,html}` +
   `nodes/.../ui-component-instance.{js,html}`, Eintrag im `node-red.nodes`-Block
   (`package.json`) und in `nodes/webapp.js` (`mapConfig`, `WEBAPP_NODE_TYPES`,
   Component-Bucket, `toComponentDefinitions`). **Bucketing:** die Definition-Kinder
   bucketen über ihr reales `.z` wie jeder ui-Knoten (kein Subflow-`.z`-Problem); die
   Definition selbst erzeugt einen `def:`-gewurzelten Subtree, den nur
   `expandComponent` konsumiert.
2. **Editor Definition:** Container für Kinder (Default-Slot `content`); Mount-Tree
   zeigt sie als Container mit Slot; kein outer-mount-Zwang.
3. **Editor Instanz:** `definitionId`-**Picker** (Referenz-Selektor, listet
   `ui-component-definition`-Knoten — wie der P114/P60-Picker), **props-Map**-Control
   (name→Wert-typedInput-Paare, hinzufügen/entfernen, jede Binding-Art), outer
   Mount-Picker, Basis-Felder wo anwendbar.
4. **Validierung sichtbar:** fehlende/ungültige `definitionId` und Definition-Self-
   Reference (aus P177) als sichtbarer Editor-/Deploy-Fehler.
5. **Spec/Doku:** `docs/nodes/structure/ui-component.md` final auf den gebauten Stand;
   Testkatalog befüllen.

## acceptance / verify

- `verify: browser` — jede acceptance-Zeile im laufenden Frontend beweisen
  (`preview_*`/Playwright). E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]; Build vor E2E,
  [[e2e-verify-build-and-no-tail]]).

## spec / tests

- spec: `docs/nodes/structure/ui-component.md` (Definition/Instance, Editor-Felder,
  v1-Cut).
- tests: `tests/e2e/nodes/view/ui-component.tests.md` + neue Spec
  `tests/e2e/nodes/view/ui-component.spec.ts` (End-to-End-Render-Beweis).

## Risiken / Hinweise

- **Dieses Paket fügt zwei neue Node-Typen hinzu** → `/node-red-node`-Skill vor dem
  Bearbeiten von Knoten-Quellen aufrufen.
- **v1:** props rein / events raus; kein Child-Slot-Projection (P142), kein
  Per-Instanz-State.
- `examples/customers-crud/flow.json` nur via `pnpm gen:example`.
