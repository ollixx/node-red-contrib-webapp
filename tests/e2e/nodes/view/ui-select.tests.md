# Testkatalog: ui-select

> Format gemäß `.ai/agents/node-testing.md`.

## P44 — Basis-Render-Pipeline (bestehend)

| Test | Ziel |
|---|---|
| renders sl-select with label and sl-option elements | End-to-End: sl-select sichtbar, Label und Optionen im DOM |
| disabled renders sl-select[disabled] | Literal `disabled:true` → disabled-Attribut im Browser |
| sl-change → POST /event with { event:'change', params:{ value: string } } | Change-Event wird korrekt an den Flow gemeldet |

## P124 — value + disabled als typedInput (ADR 0012)

### value-Binding

| Test | Ziel |
|---|---|
| value={kind:"literal",value:"de"} → sl-select renders with initial value "de" | Literal-Binding zeigt Initialwert im Browser |
| valuePath-Migration: legacy valuePath-Config → value als state-Binding resolved | Verlustfreie Migration alter valuePath-Configs |

### disabled-Binding (Boolean-Zustand-Satz)

| Test | Ziel |
|---|---|
| disabled={kind:"literal",value:true} → sl-select[disabled] sichtbar | Literal true → disabled-Attribut |
| disabled={kind:"literal",value:false} → sl-select ohne disabled-Attribut | Literal false → kein disabled-Attribut |
| disabled={kind:"store",path:"isLocked"} mit Store-Wert true → sl-select[disabled] | Store-Binding deaktiviert das Select live |

### Round-Trip

| Test | Ziel |
|---|---|
| change-Event bleibt funktional nach P124-Migration | `valuePath`-Migration bricht bestehende Event-Kette nicht |

## P133 — Options `{ json \| store }`, placeholder/label-Bindings, searchable raus (ADR 0012)

### Options (ein Feld, zwei Typen)

| Test | Ziel |
|---|---|
| Options json — Objekt-Map `{ label: value }` → sl-options | Form 1 (Objekt) wird normalisiert und gerendert |
| Options json — String-Array `["A","B"]` → value=label | Form 2 (String-Array) → Value = Label |
| Options store-Binding rendert Optionen reaktiv aus dem Store | Store-Typ liest das Options-Array live aus dem Store |
| legacy optionsBinding migriert zu (state) Options-Binding — App crasht nicht | Alt-`optionsBinding` lädt verlustfrei als state-Binding |

### placeholder / label (kanonischer Wert-Satz)

| Test | Ziel |
|---|---|
| placeholder literal → sl-select[placeholder] | Literal-Placeholder erscheint als Attribut |
| placeholder store-Binding zeigt den Live-Wert | Store-Binding rendert den Live-Placeholder |
| label store-Binding zeigt den Live-Wert | Store-Binding rendert das Live-Label |

### searchable entfernt

| Test | Ziel |
|---|---|
| legacy `searchable:true` lädt fehlerfrei | Alt-Config mit entferntem Feld lädt ohne Fehler (ignoriert) |

## P133 — Editor-Panel

| Test | Ziel |
|---|---|
| label/value/options/placeholder typedInputs vorhanden, required-label-Validierung | Ein Options-Feld, keine optionsJson/searchable; leeres Label → invalid, gefüllt → valid |

## writeTo Write-Back (P204 / ADR 0027 — gemessen, keine Verdrahtung)

| ID | Beschreibung |
|---|---|
| W01 | `value=store(x).choice` UND `writeTo=store(x).choice`: eine Auswahländerung (`sl-change`) schreibt per-client in den Store; ein ZWEITER an `store(x).choice` gebundener `ui-text` zeigt den neuen Wert live (SSE, Textinhalt gemessen `a`→`b`), ohne function-Knoten. Select hat keine Submit-Geste → schreibt bei `change` unabhängig vom `writeTrigger`. |
