---
id: P218
title: "Runtime: konsumierte msg.ui.<command>-Envelope nach erfolgreicher Verarbeitung entfernen (nur den Sub-Key) — behebt refresh→replace-Doppelverarbeitung"
epic: aspects/runtime
status: in_progress
dependencies: [P213]
verify: browser
spec: docs/nodes/concepts/events.md
tests: tests/e2e/nodes/state/ui-query-action.tests.md
---
# P218 — Konsumierte `msg.ui.<command>`-Envelope nach Verarbeitung entfernen

> Rationale: [ADR 0033](../../../adr/0033-consumed-msg-ui-command-envelope-is-deleted-after-processing.md).
> Behebt gleichzeitig den vom Owner gemeldeten refresh→replace-Bug (Punkt 2).

## findings

Owner-Report (2026-07-13, Dev-App „Entity Editor", verbatim + konkretisiert):

- „ui-query-action ‚refresh' wird in ui-query mit payload ausgewertet und dort der
  wert replaced. Das darf natürlich NICHT passieren. Payload wird da ignoriert."
- „Wir brauchen einen ADR für alle fälle, wo ein knoten eine msg.ui.xxx nachricht
  bekommt und verarbeitet. Die sollte nach einer erfolgreichen verarbeitung dann
  entfernt werden aus msg.ui. Sonst wird das objekt verschmutzt und es kann zu
  doppel-verarbeitung kommen."

Konkreter Mechanismus (getrackt): Refresh-Action (`mode=wire`) baut
`outMsg = {...msg, ui:{...msg.ui, query:{queryPath,refresh:true,params}}}` und
trägt `msg.payload` + `msg.ui.query` weiter; `ui-query` wendet den Refresh an
(`loading`) und forwardet die Msg **mit `msg.ui.query`/`msg.payload` intakt** —
downstream wird der stale `msg.payload` erneut als Query-DATEN (`replace`)
konsumiert. Owner-Entscheid: refresh-Vertrag bleibt (payload darf `params`
speisen); Wurzel ist die Msg-Verschmutzung.

## acceptance

- **Konsumierter Sub-Key wird entfernt.** Jeder Input-Handler in `webapp.js`, der
  ein Kommando-Envelope anwendet, entfernt nach **erfolgreicher** Verarbeitung
  **genau diesen** Sub-Key aus der Message: `queryInputHandler` → `delete
  msg.ui.query`; `queryActionInputHandler` (nachdem `params`/Paging aus `uiQuery`
  gelesen wurden) → der weitergereichte/emittierte Envelope enthält keinen stale
  Rest; ui-store set-via-input + `storeActionInputHandler` + `storeReadInputHandler`
  → `delete msg.ui.store`; `dialogInputHandler` → `delete msg.ui.dialog`.
- **Kontext bleibt erhalten.** `msg.ui.clientId` und ein ausgehendes
  `msg.ui.event` werden **nie** entfernt; niemals wird das ganze `msg.ui` gelöscht.
  Ist `msg.ui` nach Entfernen des Sub-Keys leer, darf es entfernt oder als `{}`
  belassen werden (dokumentiert).
- **Fehlerpfad lässt Envelope stehen.** Schlägt die Verarbeitung fehl (z.B.
  unbekannte Query/Store), bleibt der Sub-Key erhalten (diagnostizierbar/retry).
- **Refresh→replace-Repro grün.** Ein E2E-/Verhaltens-Flow, der den Owner-Fall
  nachbaut (refresh-Action → ui-query → weiter zu einem replace-Konsumenten),
  zeigt: nach dem Refresh-Hop trägt die Out-Port-Message **kein** `msg.ui.query`
  mehr, und die Query-Daten werden **nicht** vom stale `msg.payload` überschrieben.
- **Einmal-Anwendung.** Eine Kette aus zwei Kommando-Konsumenten desselben Typs
  wendet das Kommando **genau einmal** an (Test: zweiter Konsument sieht kein
  Envelope mehr).

## verify

`browser` — der refresh→replace-Fall wird im laufenden App/Flow nachgestellt
(Playwright/`preview_*` bzw. der klassische Node-Behaviour-Harness aus P81 für die
Handler-Ebene). Beweis: Out-Port-Message ohne konsumierten Sub-Key + Query-Wert
bleibt korrekt.

## spec

`docs/nodes/concepts/events.md` — kurzer „Envelope-Lifecycle: konsumiert =
entfernt"-Abschnitt (welche `msg.ui.<key>` Kommandos sind, welche Kontext).

## tests

`tests/e2e/nodes/state/ui-query-action.tests.md` (+ ggf. `ui-store-action`/
`ui-dialog` Kataloge) — listen den Cleanup-Test + den refresh→replace-Repro.

## notes for the implementer

- Betroffene Handler: `queryInputHandler` (~4927), `queryActionInputHandler`
  (~4777), ui-store set-via-input (~618), `storeActionInputHandler` (~5132),
  `storeReadInputHandler` (~5014), `dialogInputHandler` (~5349) in `nodes/webapp.js`.
- Wire-Mode-**Emitter** (die einen Envelope *produzieren*) sind NICHT der Konsument
  — dort nichts löschen. Der Konsument (der anwendende Knoten) räumt auf.
- Für den refresh-Pass-Through: der ui-query forwardet einen **sauberen** Trigger
  (frisch gebautes `msg.ui.query` mit `queryPath/refresh/params` für den Fetch),
  nicht die eingehende Message verbatim mit stale Kommando/`payload`.
