---
id: P136
node: ui-radio
epic: nodes/ui-radio
title: "ui-radio: Options als EIN typedInput {JSON+Validierung | Store} (geteilter Helfer mit ui-select) + label auf Wert-Satz"
findings:
  - "wieso hat ui-radio 'options' Felder? (Anm.: legitim — eine Radio-Group IST eine Auswahl aus Optionen; aber identisches Options-Modell wie ui-select, also derselbe Fix.)"
  - "'Options' JSON sollte den TypedInput mit JSON Editor von NR nutzen (Validierung: object(label-value) / array (nur label) / array von objects {label,value})."
  - "'Options Binding' sollte mit dem TypedInput 'Store' abgebildet werden; parallel-nutzbare Felder → eine Auswahl {JSON | Store}."
  - "'Label' > Standard Type Set."
verify: browser
spec: docs/nodes/input/ui-radio.md
tests: tests/e2e/nodes/view/ui-radio.tests.md
dependencies: [P113, P133]
status: in_progress
---
# P136 — ui-radio: Options-Fix (geteilter Helfer) + label

> Spiegelt **P133** (ui-select) auf ui-radio — die **einzigen zwei** Knoten mit
> Options haben das **identische** Modell (`optionsJson` + `optionsBinding`).
> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md);
> Store-typedInput: [ADR 0013](../../../adr/0013-store-binding-subpath.md) (Layout P134).
> Reines Editor-/Render-Paket.

## Befund (heute)

- `optionsJson` (Textfeld) **und** `optionsBinding` (Textfeld „store path") —
  identisch zu ui-select, beide parallel setzbar.
- `label` ist ein **nacktes Textfeld** (kein Binding).
- ui-radio hat **kein** `placeholder`/`searchable` (das bleibt ui-select-spezifisch, P133).

## Zielmodell

### 1. Geteilter „Options"-Helfer (eine Quelle für ui-select **und** ui-radio)

- Die Options-Logik aus P133 ist ein **geteilter Helfer** in
  `resources/lib/editor-common.js` (Vorschlag `installOptionsField()` /
  `valueBindingTypes({ category: "options" })` + `validateOptionsStructure()`):
  **ein** typedInput `{ json | store }`.
  - **`json`** — Node-REDs JSON-Editor; Validierung genau einer der drei Formen:
    1. Objekt `{ "<label>": "<value>" }`,
    2. Array von Strings `["A","B"]` (Value = Label),
    3. Array von Objekten `[{ "label":…, "value":… }]`.
    Andere Struktur → Validierungsfehler (Knoten rot, Deploy blockiert) mit
    sprechender Meldung.
  - **`store`** — der Store-typedInput (P134-Layout: Name + Pfad), reaktiv.
- **Sollte P133 den Helfer noch nicht extrahiert haben** (inline in ui-select
  gebaut): in diesem Paket **extrahieren** und ui-select darauf umstellen — **eine**
  Quelle, kein Duplikat (deshalb `dependencies: [P133]`).
- Das separate `optionsBinding`-Feld **entfällt**; Lade-Shim migriert
  bestehendes `optionsJson` (→ json-Typ) bzw. `optionsBinding` (→ store-Binding).

### 2. `label` → Wert/Anzeige-typedInput

- `label` nutzt den kanonischen Wert-Satz (P113) statt nacktem Textfeld.

## acceptance (observierbar, browser)

- **Options:** Nur **ein** „Options"-Feld; Typ `json` öffnet den NR-JSON-Editor;
  ungültige Struktur → Knoten ungültig vor Deploy (sprechende Meldung); gültige
  Form 1/2/3 rendert die Radio-Optionen. Typ `store` zeigt den Store-typedInput
  und rendert die Optionen reaktiv. Kein separates `optionsBinding`-Feld.
- **Geteilter Helfer:** ui-select **und** ui-radio nutzen denselben Options-Helfer
  (Code-Beleg: eine Definition, beide Knoten rufen sie); eine Änderung an der
  Options-Logik ist genau eine Stelle.
- **Migration:** Alt-Knoten mit `optionsJson`/`optionsBinding` öffnen im
  passenden Typ verlustfrei.
- **label:** bietet den kanonischen Wert-Satz; Store-/state-Binding zeigt den
  Live-Wert.
- Bestehende ui-radio-E2E (value/disabled P127) bleiben grün.

## spec / tests

- spec: `docs/nodes/input/ui-radio.md` — Options (ein typedInput + Validierung,
  geteilter Helfer), label (Wert-Satz).
- tests: `tests/e2e/nodes/view/ui-radio.tests.md` erweitern (Options-Validierung
  3 Formen + Fehlerfall, Store-Options, label-Binding, Migration). Unit: die
  geteilte `validateOptionsStructure` (gemeinsam mit P133 genutzt).

## Risiken / Hinweise

- Reihenfolge: nach P133 (damit der geteilte Helfer steht bzw. hier extrahiert
  und ui-select nachgezogen wird). Kein Daten-/Render-Vertragswechsel über den
  von P133 definierten hinaus.
