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
