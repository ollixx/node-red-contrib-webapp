---
id: P192
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat Item-Scope propagiert nicht durch verschachtelte Kind-tragende Knoten (ui-container, ui-tabs/ui-tab, ui-accordion/-section): deren Kinder sehen item nicht — nur nested repeat/component werden heute gescoped"
findings:
  - "Owner (2026-06-19): 'ich habe in ui-repeat einen container auf layout horizontal. in diesem sind zwei ui-text knoten mit binding auf item. geschachtelt wird das nicht gefunden. Die Knoten müssen aber immer das item des nächst höheren ui-repeats als context bekommen.'"
  - "Owner (2026-06-19): 'das nesting muss mit allen knoten laufen, die kinder haben können. check das bitte.'"
  - "Code-Befund: expandRepeat (packages/renderer/src/renderer.ts ~Z.1549) klont pro Frame nur die DIREKTEN Template-Kinder (REPEAT_SLOT) gegen den itemScope. Rekursiv mit Scope werden NUR nested repeat (Z.1561) und component-instance (Z.1573) behandelt. ui-container, ui-tabs(+ui-tab), ui-accordion(+ui-accordion-section) NICHT — deren Kinder hängen über ihre eigene Mount-Konvention (container:/ui-tabs:/ui-tab:/ui-accordion-section:) am ORIGINAL-Knoten und werden vom allgemeinen Mount-Pass OHNE itemScope + ohne Re-Id gerendert → item undefined."
acceptance:
  - "Vollständige Abdeckung — der Item-Scope + die Re-Id propagieren durch JEDEN Kind-tragenden Knoten im Repeat-Template, je über seine Mount-Konvention: ui-container (container:<id>/<slot>), ui-tabs + ui-tab (ui-tabs:…/ui-tab:<id>/content), ui-accordion + ui-accordion-section (ui-accordion-section:<id>/content), nested ui-repeat (container:<id>/content — bereits ok), ui-component-instance (def: — bereits ok)."
  - "Beweis je Container-Art: ein ui-text mit item/item.<feld>/index INNERHALB von (a) ui-container, (b) einem ui-tab eines ui-tabs, (c) einer ui-accordion-section — jeweils im ui-repeat — löst gegen das Item des umschließenden Repeats auf (je Instanz unterschiedliche Werte)."
  - "Beliebige Schachtelungstiefe + Mischung (Container im Tab im Repeat …); die existierenden per-Art-Matcher (createRepeatChildMatcher/createSlotChildMatcher/Tab-/Accordion-Resolver/def-Matcher) werden für die rekursive Scope+Re-Id-Propagation wiederverwendet — kein paralleler zweiter Pfad."
  - "Re-Id/Keying: geklonte Container UND alle Nachfahren bekommen den Per-Instanz-Präfix (itemKey#…) konsistent, sodass die inneren Mounts INNERHALB des Klons auflösen (kein Verweis aufs Original) und das keyed Morphing stabil bleibt."
  - "Strukturknoten (ui-app/ui-route/ui-dialog) sind KEINE Repeat-Kinder (top-level gemountet) → außerhalb des Scopes dieses Pakets; im Test/Spec kurz festhalten."
  - "Verschachtelte Repeats bleiben wie bisher: der innerste item-Frame gewinnt (die äußere Ebene adressieren = [[P193]])."
  - "Keine Regression: ein ui-repeat mit direkten Kindern (ohne Zwischen-Container) rendert unverändert; leere/0-Item-Fälle unverändert."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: done
---
# P192 — Item-Scope durch verschachtelte Container propagieren

> **Bug.** Der Item-Scope eines ui-repeat erreicht heute nur die **direkten**
> Template-Kinder (+ nested repeat/component). Ein **Container** dazwischen bricht
> die Kette — seine Kinder sehen `item` nicht. Sobald man (P191) einen Container
> mit Layout in den Repeat legt, ist das der Normalfall.

## Kern des Fixes

`expandRepeat` muss das **gesamte Template-Subtree** pro Item expandieren, nicht
nur die direkten Kinder:

- Beim Klonen eines **Kind-tragenden** Knotens dessen Kinder über die **jeweilige
  Mount-Konvention** finden und rekursiv klonen — gegen denselben `scopedContext`
  (Item-Frame aktiv) — und **konsistent re-iden** (innere Mounts zeigen auf den
  Klon `itemKey#…`, nicht aufs Original):
  - `ui-container` → `container:<id>/<slot>` (`createSlotChildMatcher`/`createRepeatChildMatcher`)
  - `ui-tabs`/`ui-tab` → `ui-tabs:…` / `ui-tab:<id>/content` (Tab-Resolver)
  - `ui-accordion`/`ui-accordion-section` → `ui-accordion-section:<id>/content` (Accordion-Resolver)
  - nested `ui-repeat` → `container:<id>/content` (bereits ok)
  - `ui-component-instance` → `def:` (bereits ok)
- Das ist die **Verallgemeinerung** der zwei vorhandenen Sonderfälle: **jeder**
  Kind-tragende Template-Knoten propagiert Scope + Re-Id an seine Kinder, rekursiv
  bis zu den Blättern — über die **bestehenden** per-Art-Matcher, kein zweiter
  Render-Pfad.

## acceptance / verify

- `verify: browser` — ui-repeat → ui-container(horizontal) → 2× ui-text(`item`)
  rendert je Instanz die richtigen Werte. E2E im Haupt-Checkout durch den
  Orchestrator ([[orchestrator-must-verify-e2e-in-main-checkout]]);
  Renderer-Unit für die rekursive Scope-/Re-Id-Propagation.

## Risiken / Hinweise

- **Re-Id-Konsistenz** ist der knifflige Teil: Klon-Id + alle Nachfahren-Mounts
  müssen denselben `itemKey#`-Präfix tragen, sonst kollidieren Ids oder Mounts
  lösen nicht auf. Am bestehenden `<itemKey>#<childId>`-Schema orientieren.
- **Verzahnt mit P191** (Container-Layout im Repeat) — derselbe Anwendungsfall;
  Reihenfolge im Orchestrator beachten.
- Die **äußere** Repeat-Ebene zu adressieren ist NICHT Teil dieses Fixes (das ist
  die Design-Frage [[P193]]); hier gilt weiter „nächst höheres Repeat = nächster
  item-Frame".

## Result

- **delivered:** `expandRepeat` now propagates the repeat item-scope + per-instance re-id
  (`<itemKey>#<childId>`) through **every** intermediate child-bearing template node —
  `ui-container`, `ui-tabs`/`ui-tab`, `ui-accordion`/`ui-accordion-section` — by deep-cloning the
  whole template subtree per item and rendering the cloned root against an augmented AppModel,
  generalising the prior nested-repeat / component-instance special cases into one render path (no
  second path). New helpers `cloneTemplateSubtree`, `rewriteMountParent`, `mountParentId`,
  `isChildBearingTemplateNode`. `layout:`/`def:` mount heads are intentionally excluded from
  parent-id rewrite (layout addresses a preset id; def is off-canvas). Owner's exact repro
  (container[horizontal] + two `ui-text(item)` in a repeat) is the E2E fixture.
- **stats:** renderer src + tests; renderer suite **122→130**; +2 E2E proofs in `ui-repeat.spec.ts`
  (per-row resolution through a container; cloned children carry the per-instance id prefix); fixture
  `ui-repeat-container.flow.json`; spec `docs/nodes/display/ui-repeat.md` documents scope-through-
  containers. Develop verification: build exit 0; unit green (runtime **1049** + renderer 130 + the
  new integration test); **ui-repeat E2E 6/6 green** incl. both P192 proofs; lint + validate +
  tripwires OK.
- **notes:** **Orchestrator follow-up fix** (`phase/P192`, by a fix sub-agent) — the first cut passed
  the renderer unit test but the **authoritative E2E rendered 0 child elements**. Root cause was NOT
  the propagation code (that was correct) but the E2E **fixture**: it set the container's layout as
  `"layout":"horizontal"` while the real config field (and `ui-container` `mapConfig` in
  `nodes/webapp.js`) is **`layoutId`** — so through the real deploy/compile path the container had no
  layout, produced no regions, and its whole child subtree was dropped before the propagation code ran.
  The renderer unit test missed it because it hand-builds an AppModel with `layoutId` already set,
  skipping `mapConfig`. Fix = correct the fixture field + add a **runtime integration test**
  (`p192-…-integration.test.ts`) that compiles from raw node configs through the real pipeline and
  asserts per-row resolution + per-instance ids (it fails with the typo, passes after) — closing the
  unit-vs-E2E faithfulness gap. Addressing the OUTER repeat level is deliberately left to **P193**.
- **cost:** session agent-afebe451910008442 (~14m) + fix session a33a13ec60e198682 (~9m).
