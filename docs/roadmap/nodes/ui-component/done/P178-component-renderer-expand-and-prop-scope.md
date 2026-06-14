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
status: done
---
# P178 — ui-component Renderer: expandComponent + propScope

> Zweite Schicht von [ADR 0020](../../../../adr/0020-component-model-dedicated-ui-component-node.md).
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

## Result

- **delivered:** Components wave (ADR 0020) Schicht 2 — the renderer. `expandComponent`
  (`packages/renderer/src/renderer.ts`, modelled 1:1 on `expandRepeat`): resolve the instance's
  `props` typedInputs → build one `propScope` frame → push onto a new `BindingSources.propScope`
  stack (next to `itemScope`) → render the `def:<definitionId>/content` subtree against the extended
  scope → re-id each node `<instanceId>#<innerNodeId>` → flatten into the instance's host region →
  pop. Added the `prop`/`prop.<path>` case to `resolveBinding` (against the top `propScope` frame;
  `getValueAtPath` so bare `prop` = whole value and `prop.<a.b>` reaches multi-level; outside an
  instance → `undefined`, fallback applies). Two new renderer component kinds
  (component-definition/component-instance). Touched `renderer.ts` + `contracts.ts`.
- **stats:** 3 src files + new `packages/renderer/test/p178-component-expand-prop-scope.test.ts`
  (**13 snapshot tests**, renderer 103→116). Develop verification: `pnpm build` exit 0; unit green
  (schema 353, renderer 116, editor 117, runtime 1001); **render regression 27/27 green**
  (ui-repeat + ui-list + ui-tabs — the neighbors sharing the expand/scope machinery — no regression).
  check:roadmap + check:links + lint OK.
- **notes:** **nested** — an instance/repeat inside a definition's `def:` subtree recurses against
  the extended scope; clones stack id prefixes (`<outerId>#<innerInst>#<leaf>`) like nested repeats;
  each instance resolves its own props against the current scope (an inner instance's prop can bind
  the outer `prop.*`). **self-guard** — a `visitedDefinitions` path list cuts an instance of a
  definition already on the active expansion path (returns `[]`, defined termination, no hang;
  direct `recur→recur` + transitive `A→B→A` tested). **definition-not-rendered** — relies on P177
  making `def:` mounts deliberately unresolvable by the AppModel resolver, so no region matcher
  enumerates a definition/its `def:` children directly; only `expandComponent` (via an instance)
  consumes the `def:`-rooted subtree (new `createComponentDefChildMatcher`, the repeat-child recipe
  with a `def:` head). A definition with children but no instance emits nothing — verified.
  Flagged pre-existing tech debt (NOT introduced here): a stray NUL byte in `renderer.ts` makes it
  grep-hostile — separate cleanup task spawned. **Next: P179 (node registration + editor + browser
  proof) closes the wave.**
- **cost:** session a00e7f56378783cba, ~14m (+ orchestrator develop verification).
