---
id: P133
node: ui-select
epic: nodes/ui-select
title: "ui-select: Options als EIN typedInput {JSON+Validierung | Store}, placeholder+label auf Wert-Satz, searchable entfernen"
findings:
  - "'Options' JSON sollte den TypedInput mit JSON Editor von NR nutzen (Validierung: nur object(label-value) / array (nur label) / array von objects (props: label, value))."
  - "'Options Binding' ist parallel nutzbar -> Besser wäre hier eine Auswahl (vielleicht reicht schon ein TypedInput mit (JSON und Store))."
  - "'Options Binding' sollte mit dem TypedInput 'Store' abgebildet werden."
  - "Placeholder ist ein Value und sollte auch das Standard Type-Set bekommen."
  - "'Searchable' wird weder von shoelace noch von bootstrap supported. Kann raus."
  - "'Label' > Standard Type Set."
verify: browser
spec: docs/nodes/input/ui-select.md
tests: tests/e2e/nodes/view/ui-select.tests.md
dependencies: [P113]
status: done
---
# P133 — ui-select: Options/Placeholder/Label/Searchable

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md)
> (Binding-Ubiquität). Store-typedInput-Layout: [ADR 0013](../../../../adr/0013-store-binding-subpath.md)
> + Korrektur **P134** (Options-Store nutzt denselben Store-typedInput). Reines
> Editor-/Render-Paket für ui-select.

## Befund (heute)

- **Zwei parallele Optionen-Felder:** `optionsJson` (Textfeld, Platzhalter
  `[{"label":"A","value":"a"}]`) **und** `optionsBinding` (Textfeld „store path").
  Beide gleichzeitig setzbar — verwirrend.
- `placeholder` und `label` sind **nackte Textfelder** (kein Binding).
- `searchable` (Checkbox) — wird vom Render-Target nicht unterstützt.

## Zielmodell

### 1. Options = EIN typedInput `{ json | store }`

- `optionsJson` + `optionsBinding` werden zu **einem** „Options"-typedInput:
  - **Typ `json`** — nutzt Node-REDs **JSON-Editor** (typedInput-Typ `json` mit
    Expand-Button). **Validierung** der eingegebenen Struktur (Fehler vor Deploy,
    Knoten rot): genau eine der drei Formen
    1. **Objekt** `{ "<label>": "<value>" }` (Key=Label, Wert=Value),
    2. **Array von Strings** `["A","B"]` (nur Labels; Value = Label),
    3. **Array von Objekten** `[{ "label":…, "value":… }]` (Props `label`,`value`).
    Andere Strukturen → Validierungsfehler mit sprechender Meldung.
  - **Typ `store`** — der Store-typedInput (P134-Layout: Name + Pfad). Liest die
    Optionen reaktiv aus einem Store(-Pfad).
- Das separate `optionsBinding`-Feld **entfällt**; `optionsJson` wird zum
  Binding-Objekt migriert (Lade-Shim: bestehender `optionsJson`-String →
  `{kind:"literal"/"json", …}`; bestehender `optionsBinding` → `store`-Binding).

### 2. `placeholder` → Wert/Anzeige-typedInput

- `placeholder` nutzt den kanonischen Wert-Satz (P113) — wie jeder Display-Wert.

### 3. `label` → Wert/Anzeige-typedInput

- `label` nutzt den kanonischen Wert-Satz (P113) statt nacktem Textfeld.

### 4. `searchable` entfernen

- Feld aus `defaults`, HTML und der Render-Pipeline entfernen; Lade-Shim
  ignoriert ein bestehendes `searchable` (kein Fehler).

## acceptance (observierbar, browser)

- **Options:** Nur **ein** „Options"-Feld; Typ `json` öffnet den NR-JSON-Editor;
  ungültige Struktur (z. B. `[1,2,3]` oder `{"a":{}}`) → Knoten ungültig vor
  Deploy mit sprechender Meldung; gültige Form 1/2/3 deployt und rendert die
  Optionen. Typ `store` zeigt den Store-typedInput (Name + Pfad) und rendert die
  Optionen aus dem Store reaktiv. Kein separates `optionsBinding`-Feld mehr.
- **Migration:** Alt-Knoten mit `optionsJson` öffnet im json-Typ mit demselben
  Inhalt; Alt-Knoten mit `optionsBinding` öffnet im store-Typ.
- **placeholder/label:** beide bieten den kanonischen Wert-Satz; ein Store-/
  state-Binding zeigt den Live-Wert.
- **searchable:** Feld existiert nicht mehr (Editor, Schema, Render); Alt-Config
  mit `searchable:true` lädt fehlerfrei (ignoriert).
- Bestehende ui-select-E2E bleiben grün; value/disabled (P124) unverändert.

## spec / tests

- spec: `docs/nodes/input/ui-select.md` — Options (ein typedInput + Validierung),
  placeholder/label (Wert-Satz), searchable-Entfernung dokumentieren.
- tests: `tests/e2e/nodes/view/ui-select.tests.md` erweitern (Options-Validierung
  3 Formen + Fehlerfall, Store-Options, placeholder/label-Binding,
  searchable-Migration). Unit: die Options-Struktur-Validierung als reine Funktion.

## Result

- **delivered:** ui-select reworked per ADR 0012 — the parallel `optionsJson`/`optionsBinding`
  fields collapse into one Options typedInput `{ json | store }` (json type validates the 3
  accepted structures pre-deploy and marks the node red on failure; store type renders the
  options array reactively from a store path); `label` and `placeholder` now use the canonical
  value-binding set with live store/state resolution; `searchable` removed from schema, editor,
  HTML and render. Lossless migration shims for legacy `optionsJson` → json literal,
  `optionsBinding` → state binding, plain-string `label` → literal binding, and `searchable`
  (ignored). A pure `normalizeSelectOptions` validator lives in `@schema` (mirrored in
  editor-common for the browser editor); the renderer gained a structural binding path so a
  store slice that is legitimately an array is no longer rejected by the display-scalar guard.
- **stats:** 15 files changed (1 new schema test file); +23 unit tests (schema 259→274) and
  +8 ui-select E2E specs plus the rewritten editor-panel spec; 0 nodes added (ui-select already
  existed). Develop verification: `pnpm build` exit 0, full Playwright suite **502 passed / 0
  failed** (8.1m); `pnpm validate` + `check:links` + `check:roadmap` all OK.
- **notes:** The store-options rejection by the display-only `resolveStoreBinding` was the one
  non-obvious issue — fixed with a dedicated `resolveStructuralBinding` used only for select
  `options`, leaving the display-scalar contract untouched. Per-node example
  `examples/view/ui-select.json` regenerated via `gen:node-examples` (generator updated to the
  new binding shape; only that one file changed). `label` keeps its required-validation via a
  typedInput-aware `validate`. No friction-log entry needed.
- **cost:** session ad444a1fcbbe50a24, ~33m (orchestrator-measured wall-clock incl. develop E2E).
