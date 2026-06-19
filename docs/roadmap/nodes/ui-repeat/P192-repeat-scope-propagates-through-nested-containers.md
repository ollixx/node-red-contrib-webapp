---
id: P192
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat Item-Scope propagiert nicht durch verschachtelte Container: Kinder eines Containers IM Repeat sehen item nicht (nur direkte Template-Kinder + nested repeat/component werden gescoped)"
findings:
  - "Owner (2026-06-19): 'ich habe in ui-repeat einen container auf layout horizontal. in diesem sind zwei ui-text knoten mit binding auf item. geschachtelt wird das nicht gefunden. Die Knoten müssen aber immer das item des nächst höheren ui-repeats als context bekommen.'"
  - "Code-Befund: expandRepeat (packages/renderer/src/renderer.ts ~Z.1549) klont pro Frame nur die DIREKTEN Template-Kinder (REPEAT_SLOT) gegen den itemScope. Nested repeat (Z.1561) + component-instance (Z.1573) rekursieren mit scopedContext — ein gewöhnlicher Container NICHT. Dessen Kinder sind über container:<origId>/content am ORIGINAL-Container gemountet; nach dem Klonen zeigt der Klon auf itemKey#origId, die Kinder aber weiter auf origId → sie werden vom allgemeinen Mount-Pass OHNE itemScope (und ohne Re-Id) gerendert → item undefined."
acceptance:
  - "Ein ui-text in einem ui-container, der in einem ui-repeat gemountet ist, löst sein item/item.<feld>/index gegen das Item des umschließenden ui-repeats auf (sichtbar je Instanz unterschiedliche Werte)."
  - "Gilt für beliebige Container-Schachtelungstiefe im Repeat-Template (Container im Container im Repeat …) und für alle slot-tragenden Knoten (ui-container, ui-repeat-content, tabs/accordion-Sektionen, …)."
  - "Re-Id/Keying: die geklonten Container UND ihre Kinder bekommen den Per-Instanz-Präfix (itemKey#…) konsistent, sodass die inneren Mounts INNERHALB des Klons auflösen (kein Verweis auf den Original-Container) und das keyed Morphing stabil bleibt."
  - "Verschachtelte Repeats bleiben wie bisher: der innerste item-Frame gewinnt (die äußere Ebene zu adressieren ist separat — [[P193]])."
  - "Keine Regression: ein ui-repeat mit direkten Kindern (ohne Zwischen-Container) rendert unverändert; leere/0-Item-Fälle unverändert."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: pending
---
# P192 — Item-Scope durch verschachtelte Container propagieren

> **Bug.** Der Item-Scope eines ui-repeat erreicht heute nur die **direkten**
> Template-Kinder (+ nested repeat/component). Ein **Container** dazwischen bricht
> die Kette — seine Kinder sehen `item` nicht. Sobald man (P191) einen Container
> mit Layout in den Repeat legt, ist das der Normalfall.

## Kern des Fixes

`expandRepeat` muss das **gesamte Template-Subtree** pro Item expandieren, nicht
nur die direkten Kinder:

- Beim Klonen eines slot-tragenden Knotens (Container, …) **auch dessen Kinder**
  (über `container:<id>/content` etc.) rekursiv klonen — gegen denselben
  `scopedContext` (Item-Frame aktiv) — und **konsistent re-iden**, sodass die
  inneren Mounts auf den **Klon** (`itemKey#…`) statt aufs Original zeigen.
- Das ist die Verallgemeinerung der bereits vorhandenen Sonderfälle (nested
  repeat/component): **jeder** slot-tragende Template-Knoten propagiert Scope +
  Re-Id an seine Kinder, rekursiv bis zu den Blättern.

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
