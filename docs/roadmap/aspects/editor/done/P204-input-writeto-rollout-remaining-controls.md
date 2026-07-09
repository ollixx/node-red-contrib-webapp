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
status: done
---
# P204 — Rollout Input-Write-Back auf die restlichen Kontrollen

> Entscheidung & Begründung: [ADR 0027](../../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md).
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

## Result

- **delivered:** The P203 write-back mechanism (`writeToBindingSchema` + `writeTriggerSchema`, the
  `writable` typedInput category, `applyInputWriteBack`) rolled out **unchanged** to the 7 remaining
  input controls — **ui-select, ui-checkbox, ui-switch, ui-textarea, ui-slider, ui-radio, ui-datepicker**.
  A single shared editor helper (`installWriteToField`/`saveWriteToField` in `editor-common.js`) makes
  every node's `writeTo` field identical. Schema (`node-definitions.ts`): optional `writeTo` (writable
  kinds only) + `writeTrigger` added to all 7 (additive; legacy `storeId`/`path` stripped + migrated at
  the editor/runtime layer). Editor: each of the 7 `*.html` got the `writeTo` typedInput + `writeTrigger`
  select + a Write-To row + on-open legacy migration + help. Runtime (`webapp.js`): `applyInputWriteBack`
  now spans all 8 input types; the dispatch gate is generalised — text-like (input/textarea/datepicker)
  honour `submit`, the non-text controls write on `change` regardless of `writeTrigger` (so `submit` ≠
  "never writes"). Client (`webapp-client.js`): textarea gained a **blur** submit gesture (Enter is a
  newline); sl-input/datepicker keep Enter/`sl-input-submit`.
- **per-type semantics (implemented + documented, not guessed):** ui-slider persists a numeric-as-string
  value (no text value); ui-checkbox/ui-switch persist `params.checked` (boolean), not `value`;
  ui-textarea submit = blur; ui-datepicker is an `sl-input` (text-like, submit via `sl-input-submit`).
- **stats:** 34 files changed + 2 new tests (schema P204 rollout = 49; runtime rollout; 7 E2E specs).
  Develop verification: build 0; full unit green (**schema 450 / runtime 1096**); **input E2E 101/101
  green** across all 8 controls, every write-back **measured** (a second ui-text bound to the same store
  slice changes live via SSE, NO function wiring: select a→b, checkbox false→true, switch false→true,
  textarea seed→committed-on-blur, slider 10→73, radio red→blue, datepicker submit 2024-01-01→2026-12-31
  + change-mode 2024-02-02→2027-07-07; submit-mode correctly does NOT write on an intermediate change);
  full suite **660 passed** (only the pre-existing accordion + the flaky ui-tabs `sl-tab-show` race, both
  chipped, neither a P204 regression); check:specs/links/roadmap + lint green.
- **notes:** Reused P203's mechanism verbatim — no new write-back path invented. The ui-tabs E01 flake
  is the known load-sensitive `interceptNextEvent` race (passes in isolation; unrelated to the textarea
  focusout change — tabs use neither). ui-input untouched (P203 owns it). With P203+P204 done, **every
  input control is now genuinely two-way** (value=read, writeTo=write) — the ADR 0027 feature is complete.
- **cost:** session agent-a2fbe80d56df1a3f1, ~34m.
