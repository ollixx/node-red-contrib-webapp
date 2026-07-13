---
id: P220
title: "Rendering: `onMissing` Folgeverhalten — `errorPort` (Fehler-Out-Port), `throw` (Catch-fähig), Fallback-Slot + P105-Affordance"
epic: aspects/rendering
status: deferred
deferred_reason: "Baut auf P219 (onMissing-Foundation) auf; braucht Knoten-Error-Out-Port + Catch-fähigen Emit (node.error(_,msg)) und die Slot-/Icon-Affordance — eigener, größerer Zug nach dem Foundation-Selektor."
dependencies: [P219]
verify: browser
spec: docs/nodes/concepts/reactive-expressions.md
tests: tests/e2e/nodes/editor/reactive-expression.spec.ts
---
# P220 — `onMissing`: `errorPort`, `throw`/Catch, Fallback-Slot + Affordance

> Rationale: [ADR 0034](../../../../adr/0034-per-field-missing-binding-behavior-selector.md).
> Folgepaket zu [P219](../P219-onmissing-selector-foundation.md) — die reicheren,
> visuell/verdrahtungs-seitigen `onMissing`-Verhalten. Absorbiert den deferierten
> „Catch-fähig"-Task und re-scopet die Invalid-Value-Affordance
> [P105](P105-invalid-value-warning-affordance.md) unter ADR 0034.

## findings

Owner (2026-07-13, verbatim): die vier Wahlmöglichkeiten für „fehlendes Binding" —
`Default '?' (das könnte ein Slot sein)`, `error out-port`, `error werfen und per
catch abfangen`, `ignorieren`. P219 liefert `marker`/`ignore`; **dieses Paket** die
übrigen:

- `errorPort` — der Knoten bekommt einen dedizierten **Fehler-Out-Port**, der die
  strukturierte Fehlermeldung (ADR 0006-Shape) führt, wenn das Feld unauflösbar ist.
- `throw` — **Fehler werfen**, den ein Node-RED **Catch**-Knoten fängt (via
  `node.error(text, msg)`, die catchbare 2-arg-Form — die Mechanik des deferierten
  „Catch-fähig"-Follow-ups aus ADR 0032).
- **Fallback-Slot** als reiche Form von `marker`: ein Slot, den der Autor mit
  eigenem „kein Wert"-Inhalt füllt (statt nacktem `?`).
- **P105-Affordance:** Achtung-Icon / Alert statt nacktem `"?"` — die visuelle Form
  des `marker`-Defaults, jetzt unter ADR 0034 gebündelt.

## acceptance

- **`errorPort`.** Ein Feld mit `onMissing:errorPort` an einem View-Knoten führt
  bei unauflösbarem Binding die strukturierte Meldung (severity/code/message/
  context{appId,nodeId}) auf einem **Fehler-Out-Port** des Knotens aus; ohne
  gesetztes `errorPort` existiert kein Extra-Port (kein Vertragsbruch bestehender
  Knoten). Verdrahtbar + im Browser/Flow bewiesen.
- **`throw`/Catch.** `onMissing:throw` → `node.error(text, msg)` mit der ADR-0006-
  Payload als `msg`; ein verdrahteter **Catch**-Knoten empfängt sie (E2E-Beweis).
- **Fallback-Slot.** `marker` mit konfiguriertem Fallback-Slot rendert den
  Autoren-Inhalt statt `"?"`; leer/kein Slot → weiter `"?"` (bzw. P105-Affordance).
- **P105-Affordance.** Das nackte `"?"` wird durch Achtung-Icon + Alert/Dialog
  ersetzt (Übernahme der P105-Kriterien) — als Default-Darstellung von `marker`.
- **Editor.** Der `onMissing`-Selektor bietet alle vier Werte; `errorPort`/`throw`
  zeigen ihre abhängigen Felder (z.B. Slot-Auswahl bei `marker`+Slot). Round-trip.

## verify

`browser` — `errorPort`/`throw` an laufender App/Flow verdrahtet und bewiesen
(Catch empfängt; Fehler-Port feuert); Slot/Affordance visuell gemessen.

## spec

`docs/nodes/concepts/reactive-expressions.md` + die value-rendering-Doku +
`docs/nodes/concepts/events.md` (Fehler-Port/Catch-Semantik).

## tests

`tests/e2e/nodes/editor/reactive-expression.spec.ts` + ein E2E mit Catch-Knoten +
Fehler-Port-Verdrahtung.

## notes for the implementer

- Übernimmt die Kriterien von [P105](P105-invalid-value-warning-affordance.md)
  (Achtung-Icon/Alert) — P105 gilt als in dieses Paket re-scopet; beim Umsetzen
  P105 entsprechend abschließen/verweisen.
- `throw` nutzt dieselbe catchbare Emit-Mechanik wie der Session-Follow-up „Make
  framework warnings Catch-node catchable".
