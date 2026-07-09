---
id: P204
title: "Rollout `writeTo`/`writeTrigger` + Runtime-Write-Back auf die übrigen Input-Knoten (select/checkbox/switch/textarea/slider/radio/datepicker) + je Node-Tests + Doku"
epic: aspects/editor
findings:
  - "Owner (2026-07-08): der einheitliche Read-`value` / Write-`writeTo`-Aufbau soll für ALLE Input-Knoten gelten, nicht nur ui-input — 'so würde es einheitlich aussehen und dem Benutzer einfacher machen.'"
  - "P203 baut die geteilte Mechanik (Schema-Kontrakt `writeTo`/`writeTrigger`, editor-common-typedInput-Helfer, Runtime-Write-Back Store/Flow/Global, Legacy-Migration) und beweist sie an ui-input. Die übrigen sieben Input-Knoten tragen noch das alte/kein Write-Back-Modell."
acceptance:
  - "Jeder der sieben Knoten — ui-select, ui-checkbox, ui-switch, ui-textarea, ui-slider, ui-radio, ui-datepicker — erhält das `writeTo`-typedInput (Store/Flow/Global, gleicher Helfer wie ui-input) und das `writeTrigger`-Select; alte Write-Ziel-/Legacy-Felder (sofern vorhanden, z. B. storeId/path/valuePath-Äquivalente) verschwinden aus dem UI und werden verlustfrei nach `writeTo`/`value` migriert."
  - "Trigger-Semantik pro Typ ist festgehalten und implementiert: Text-artige (textarea, datepicker im Textmodus) honorieren `submit` (Enter/Blur); Toggles/Selects/Slider/Radio (checkbox, switch, select, slider, radio) haben kein submit-Gesten → schreiben effektiv bei `change`, unabhängig vom Select-Wert."
  - "Runtime Write-Back je Knoten (browser, rot→grün): eine Nutzer-Interaktion (Auswahl/Toggle/Schieben/Datum) mit gesetztem `writeTo=store(x).k` aktualisiert den Store-Slice per-client (mit clientId) und ein zweiter an `store(x).k` gebundener View zeigt den neuen Wert live — je Knoten per Messung belegt. Flow/Global analog wie in P203."
  - "Je Knoten: docs/nodes/input|feedback/<node>.md auf value(read)/writeTo(write)/writeTrigger aktualisiert; die Node-Test-Kataloge (tests/e2e/nodes/**/<node>.tests.md) listen die neuen Write-Back-Tests; alte 'renders'-only-Asserts nicht ausreichend (node-testing.md)."
  - "Regression: die bestehenden `change`/`submit`-Output-Events aller sieben Knoten feuern weiter (additiv); keine Änderung am reinen Anzeige-Rendering."
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/view/ui-select.tests.md
dependencies: [P203]
status: in_progress
---
# P204 — Rollout Input-Write-Back auf die restlichen Kontrollen

> Entscheidung & Begründung: [ADR 0027](../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md).
> Wendet die in **P203** an ui-input bewiesene Mechanik einheitlich auf die
> übrigen sieben Input-Knoten an.

## Umfang

`ui-select`, `ui-checkbox`, `ui-switch`, `ui-textarea`, `ui-slider`, `ui-radio`,
`ui-datepicker` — je: `writeTo`-typedInput (Store/Flow/Global) + `writeTrigger`,
Runtime-Write-Back beim Trigger, Legacy-Migration, Doku + Node-Test-Katalog.

## acceptance / verify

- `verify: browser` — pro Knoten wird der Write-Back per **Messung** bewiesen
  (Interaktion ⇒ Store-Slice aktualisiert ⇒ zweiter gebundener View ändert sich
  live), im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- Node-Tests fresh nach `.ai/agents/node-testing.md`; `.tests.md`-Kataloge je
  Knoten aktuell.

## Risiken / Hinweise

- **Kein submit bei Nicht-Text-Kontrollen** — Trigger-Semantik explizit pro Typ
  (siehe acceptance), damit ein `writeTrigger=submit` an einem Toggle nicht „nie
  schreibt".
- Große Fläche: sieben Knoten. Falls ein Knoten ein Sondermodell hat (z. B.
  ui-slider ohne Textwert), im Package-Vollzug dokumentieren, nicht raten.
