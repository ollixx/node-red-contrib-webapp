---
id: P187
title: "Showcase-Spec-Muster + Pilot: fixture-getriebene Feature-Tour-Specs (test.step-Kapitel, App-Verhalten + Config-Dialog) für ui-list, ui-repeat, ui-query→ui-list"
epic: aspects/test-infra
findings:
  - "Owner (2026-06-15): pro Knoten die Benutzung in Node-RED simulieren, jedes Feature einmal durchspielen, nötige Nachbar-Knoten dazupacken, im Browser als Review-Video. Ansatz: fixture-getrieben, dabei auch den Config-Dialog des Knotens zeigen (ADR 0022 §2)."
acceptance:
  - "Ein wiederverwendbares Showcase-Helfer/Muster (tests/e2e/showcase/…): Flow-Fixture importieren → deployen → App öffnen; jeder Feature-Schritt in einem benannten test.step (erscheint als Kapitel im Trace/Report); selektiv den Knoten-Config-Dialog im Editor öffnen, damit die Felder/typedInputs im Video sichtbar sind."
  - "Pilot 1 — ui-list: ein Flow zeigt die Item-Schema-Felder, displayType-Intents (plain/divided/grouped/actionable), value als secondary/badge, Icon, color, Single-Select; jeder Punkt ein test.step; assertet UND filmbar."
  - "Pilot 2 — ui-repeat: String-Array via whole-item + index, Objekt-Array via item.<feld>, keyed Update; Schritte als Kapitel."
  - "Pilot 3 — ui-query→ui-list: der volle Daten-Pfad (route onEnter → ui-query → function-Shaper → ui-list) lädt und rendert; Lade-/Daten-Zustand sichtbar."
  - "Die drei Pilot-Fixtures sind selbstständig (ui-app/ui-route + nötige Knoten); im test:showcase-Profil (P186) entstehen Videos + Traces."
  - "Die drei *.tests.md-Kataloge verweisen auf die Showcase-Spec; das Format ist so dokumentiert, dass der Rollout auf weitere Knoten klar ist."
verify: browser
spec: docs/adr/0022-per-node-review-videos-fixture-driven-showcase.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: [P186]
status: in_progress
---
# P187 — Showcase-Spec-Muster + Pilot

> Stufe 2 aus [ADR 0022](../../../adr/0022-per-node-review-videos-fixture-driven-showcase.md).
> Beweist das **paced Feature-Tour-Format** an drei Knoten, bevor wir auf ~37
> ausrollen. Setzt auf das Video/Report-Target aus **P186** auf.

## Umfang

1. **Showcase-Helfer** (`tests/e2e/showcase/`): Fixture importieren + deployen +
   App öffnen (reuse `gotoEditor`/`waitForNodeTypes`, [[e2e-editor-registration-race]]),
   plus ein `openConfig(nodeId)`-Helfer, der den Editor-Dialog des Knotens öffnet
   und kurz hält (fürs Video). Jeder Feature-Schritt in einem benannten
   `test.step`.
2. **Drei Pilot-Specs + Fixtures:**
   - `ui-list` — Item-Schema, displayType-Intents, value (secondary/badge), Icon,
     color, Single-Select.
   - `ui-repeat` — String-Array (whole-`item` + `index`), Objekt-Array
     (`item.<feld>`), keyed Update.
   - `ui-query → ui-list` — voller Daten-Pfad inkl. Lade-/Daten-Zustand.
3. **Doku:** das Muster + der Rollout-Plan in den `*.tests.md` + Verweis aus
   `.ai/agents/node-testing.md`.

## acceptance / verify

- `verify: browser` — die drei Showcase-Videos/Traces im HTML-Report; im
  Haupt-Checkout durch den Orchestrator erzeugt
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Demo das auch assertet** — die Schritte prüfen echte Outcomes, das Pacing
  dient nur dem Review (kein reines „Klick-Theater").
- Rollout auf die restlichen Knoten ist **Folgearbeit** (inkrementell, je Knoten),
  nicht Teil dieses Pakets.
- Pilot hängt an **P186** (Video/Report-Target muss stehen); ui-list-Inhalte
  profitieren von P183 (Design) — aber das Showcase filmt den jeweils aktuellen
  Stand, unabhängig davon.
