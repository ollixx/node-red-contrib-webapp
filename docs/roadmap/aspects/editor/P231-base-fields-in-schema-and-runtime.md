---
id: P231
title: "Schema/Runtime: Base-Fields (visible/disabled/color) in ALLE Node-Schemas + Laufzeit-Verdrahtung — heute vom Schema gestrippt, daher auf ~30 Knoten wirkungslos"
epic: aspects/editor
status: pending
dependencies: [P222]
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/view/ui-divider.spec.ts
---
# P231 — Base-Fields in Schema + Laufzeit

> Aufgedeckt vom Node-Konformitäts-Pilot [P230](../node-conformance/P230-conformance-ui-divider.md).
> Hochpriorer Cross-Cutting-Fix — Prerequisit für ADR 0037 (dynamic-state/visible).

## findings (verifiziert 2026-07-14)

- Der **P222**-Editor-Rollout hat `visible`/`disabled`/`color` auf allen View-Knoten
  als Editor-Controls eingebaut — aber die **Schemas** (`packages/schema/src/node-definitions.ts`)
  deklarieren sie fast nirgends: **`visible` in 4/33**, **`color` in 1/33** (nur
  `uiListNodeDefinitionSchema`). Zod **strippt** nicht deklarierte Keys bei der
  Validierung → die Base-Fields erreichen die Laufzeit nie.
- Beleg (Divider-Pilot): ein deployter `ui-divider` mit `color: {kind:"literal",
  value:"#ff0000"}` kommt in `mapConfig` als `component.color === undefined` an — vom
  Schema entfernt (`uiDividerNodeDefinitionSchema` hat nur `type`/`orientation`/`label`).
- Folge: `visible`/`disabled`/`color` sind auf **~29–32 Knoten zur Laufzeit
  wirkungslos**, obwohl Editor + Doku sie anbieten. Das **untergräbt ADR 0037**
  (dynamic-state/visible funktioniert nur für die 4 Schema-Knoten).
- Zusatzbefund: das color→`bind.color`-Routing in mapConfig ist ebenfalls
  **list-only** (`p16Kind === "list"`) — selbst mit Schema-Fix braucht color das
  generische Routing. Der Divider-Serializer rendert `--color` nicht (beides im
  Pilot bewiesen/prototypisiert, dann zurückgenommen für einen einheitlichen Fix).

## acceptance

- **Schema trägt die Base-Fields.** Jeder Knoten, der `visible`/`disabled`/`color`
  im Editor anbietet (installBaseFields-Applicability aus P222), deklariert sie in
  seinem Node-Definition-Schema (als `bindingSchema.optional()`), am besten über ein
  **gemeinsames Base-Field-Mixin** statt pro Schema kopiert. Nach Validierung sind
  die Felder **erhalten** (nicht gestrippt).
- **mapConfig routet generisch.** `color` → `bind.color` für **alle** Base-Field-
  Knoten (nicht nur `list`); `visible`/`disabled` → `visibleIf`/`enabledIf` generisch
  (bereits P172, gegenprüfen).
- **Rendering wirkt.** Ein gebundenes `color` färbt die Darstellung (z.B. Divider:
  `sl-divider --color`; für weitere Knoten je Serializer-Pfad); ein gebundenes
  `visible=false` blendet aus (Render-Gate); `disabled` sperrt Interaktion.
- **Browser-Beweis (repräsentativ):** an mind. ui-divider (color + visible),
  ui-text/ui-badge (color), einem Input-Knoten (disabled) im laufenden App bewiesen
  (gemessen). Der `visible=false`-Fall blendet real aus.
- **P230 entblockt:** die `test.fixme`-Divider-Tests (color + visible) werden
  ent-fixmed und grün.
- **`check:specs`/`check:fields` grün**; bestehende Suites grün.

## verify

`browser` — Base-Field-Wirkung an einem repräsentativen Knotensatz im laufenden App
(Playwright, gemessen: Linienfarbe/Sichtbarkeit/disabled).

## spec

`docs/nodes/concepts/editor.md` (Base-Field-Konzept: Editor **und** Schema **und**
Laufzeit) + betroffene Node-Specs, wo „Laufzeit folgt mit dem Rollout" noch steht.

## tests

`tests/e2e/nodes/view/ui-divider.spec.ts` (color/visible ent-fixmen) + repräsentative
Base-Field-Laufzeit-Tests weiterer Knoten.

## notes for the implementer

- Root: `packages/schema/src/node-definitions.ts` — nur `uiListNodeDefinitionSchema`
  (visible/disabled/color) + 4 Schemas mit `visible`. Ein **Base-Field-Mixin**
  (`.extend(baseFields)`) auf alle applicable Knoten anwenden; Applicability-Tabelle
  aus P222 nutzen (welcher Knoten welches Feld).
- mapConfig: `colorBinding`-Zeile (`p16Kind === "list"`) generisch machen; Serializer-
  Pfade der Knoten um die color-Anwendung ergänzen (Divider: `--color`, bewiesen).
- Prerequisit für ADR 0037 (P225/P226 nehmen an, dass `visibleIf` wirkt).
