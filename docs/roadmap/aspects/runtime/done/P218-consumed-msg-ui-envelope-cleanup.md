---
id: P218
title: "Runtime: konsumierte msg.ui.<command>-Envelope nach erfolgreicher Verarbeitung entfernen (nur den Sub-Key) — behebt refresh→replace-Doppelverarbeitung"
epic: aspects/runtime
status: done
dependencies: [P213]
verify: browser
spec: docs/nodes/concepts/events.md
tests: tests/e2e/nodes/state/ui-query-action.tests.md
---
# P218 — Konsumierte `msg.ui.<command>`-Envelope nach Verarbeitung entfernen

> Rationale: [ADR 0033](../../../../adr/0033-consumed-msg-ui-command-envelope-is-deleted-after-processing.md).
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

## Result

**Delivered.** Konsumierte `msg.ui.<command>`-Envelopes werden nach erfolgreicher Verarbeitung nicht mehr weiterverschmutzt (ADR 0033); behebt den Owner-`refresh→replace`-Doppelverarbeitungs-Bug.
- **`nodes/webapp.js`**: neuer Helfer `stripConsumedUiEnvelope(msg, key)` (shallow-copy, löscht genau einen Sub-Key, mutiert Input nie, behält `clientId`/`event`, nukt `msg.ui` nie). `queryInputHandler`: `appliedTrigger`-Flag; beim Forward wird ein SAUBERER Fetch-Trigger re-emittiert (`enrichTriggerWithCurrentParams` baut frisches `msg.ui.query`) und die stale `msg.payload` VERWORFEN (kann downstream nicht als `replace`-Daten re-konsumiert werden); fremde/unerkannte Pass-Throughs bleiben byte-identisch (P175/P214). `normalizeStoreOperationMessage`: weist ein Store-Envelope mit `event`-Feld ab (verbrauchte `changed`/`read`-Notification ist kein re-konsumierbares Kommando → Store apply-once). `dialogInputHandler`: strippt `msg.ui.dialog` nach Erfolg.
- **Empty-`msg.ui`-Wahl:** als `{}` belassen (dokumentiert + getestet).
- **Doku** `docs/nodes/concepts/events.md` (Abschnitt „Envelope-Lifecycle: konsumiert = entfernt"). Kataloge (ui-query-action/ui-query/ui-store-action) mit Cleanup- + Repro-Einträgen.

**Reconciliation (validiert gegen ADR 0033 Decision).** Acceptance #4 wörtlich „Out-Port ohne `msg.ui.query`" ist mit P175/P214 nicht möglich — der Fetch-Trigger MUSS `msg.ui.query` (`queryPath/refresh/params`) tragen. ADR 0033 Decision schreibt genau die umgesetzte Form vor: sauberer, frisch gebauter Trigger; die eingehende **stale** `msg.ui.query`/`payload` wird nicht verbatim in eine re-verarbeitbare Position getragen. Store-Handler können analog nicht `delete msg.ui.store` (P211/P209 erwarten die `changed`/`read`-Notification auf `msg.ui.store`) — stattdessen ersetzt das frische Event das Kommando + der Consumer-Guard macht es nicht-re-konsumierbar.

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/state/ui-query-refresh-replace-cleanup.spec.ts` **1 passed** (2.6s): nach einem REFRESH mit vergiftetem Payload zeigt der Query-Readout `CLEAN`, nie `POISON` (stale Payload überschreibt die Query nicht).

**Stats.** Unit grün: runtime 1211 (+16 P218). Cross-cutting explizit grün gehalten: P175/P160/P161/P212/P213/P214/P211/P209/P110/P80/P12/P81. `pnpm build`/`test`/`lint`/`check:specs`/`check:roundtrip`/`check:links`/`check:roadmap` grün.

**Cost.** Sub-Agent `phase/P218` (worktree), ~28 min (16:41:42Z→17:09:53Z); nach einem Netz-Ausfall (ConnectionRefused) aus dem Transkript fortgesetzt, kein Verlust. Token-Zeile in `.ai/agent-runs.jsonl`.
