# Testkatalog: ui-radio

> Format gemäß `.ai/agents/node-testing.md`. P127 (ADR 0012 — Binding-Ubiquität);
> P136 (geteilter Options-Helfer mit ui-select + label-Binding).

## R — Rendering

| ID  | Beschreibung | Selector | Erwartung |
|-----|---|---|---|
| R01 | `sl-radio-group` sichtbar mit Label und `sl-radio`-Optionen | `sl-radio-group` | sichtbar; `label`-Attribut; `sl-radio[value]` vorhanden |
| R02 | Orientierung (`horizontal`) rendert Gruppe | `sl-radio-group` | sichtbar |

## V — Value Binding (P127 / ADR 0012)

| ID  | Beschreibung | Config | Erwartung |
|-----|---|---|---|
| V01 | Literal-String-Binding setzt Initial-Selektion | `value:{kind:"literal",value:"banana"}` | `.value === "banana"` |
| V02 | State-Binding löst Live-Wert aus Client-State auf | `value:{kind:"state",path:"radioState"}`, Store mit `"l"` | `.value === "l"` |
| V03 | Legacy `valuePath` → State-Migration verlustfrei | `value:null, valuePath:"legacyRadio"`, Store mit `"red"` | `.value === "red"` |

## D — Disabled Binding (P127 / ADR 0012 / boolean category)

| ID  | Beschreibung | Config | Erwartung |
|-----|---|---|---|
| D01 | Literal `true` rendert `sl-radio-group[disabled]` | `disabled:{kind:"literal",value:true}` | Attribut `disabled` vorhanden |
| D02 | Literal `false` — kein `disabled`-Attribut | `disabled:{kind:"literal",value:false}` | Attribut `disabled` null |
| D03 | Store-Binding deaktiviert Gruppe live bei truthy | Store initial `false` → inject `true` | `sl-radio-group[disabled]` wird sichtbar |

## O — Options (P136 / geteilter Helfer, json | store)

| ID  | Beschreibung | Config | Erwartung |
|-----|---|---|---|
| O01 | json Form 3 (Array von `{label,value}`) rendert Optionen | `options:{kind:"literal",value:[{label,value},…]}` | `sl-radio[value='s']` + `[value='l']` sichtbar |
| O02 | json Form 2 (String-Array, value = label) | `options:{kind:"literal",value:["A","B"]}` | `sl-radio[value='A']` + `[value='B']` sichtbar |
| O03 | json Form 1 (Objekt-Map `{label:value}`) | `options:{kind:"literal",value:{Germany:"de",France:"fr"}}` | `sl-radio[value='de']` + `[value='fr']` sichtbar |
| O04 | Store-Binding rendert Optionen reaktiv | `options:{kind:"store",path:"rd13Store"}`, Store mit Array | `sl-radio[value='1']` + `[value='2']` sichtbar |
| O05 | Legacy `optionsJson` migriert verlustfrei | nur `optionsJson` gesetzt | `sl-radio[value='old']` sichtbar |

## L — Label Binding (P136 / kanonischer Wert-Satz)

| ID  | Beschreibung | Config | Erwartung |
|-----|---|---|---|
| L01 | Store-Binding zeigt den Live-Label-Wert auf der Gruppe | `label:{kind:"store",path:"rd15Store"}`, Store mit `"Choose a size"` | `sl-radio-group[label="Choose a size"]` |

## E — Events

| ID  | Beschreibung | Aktion | Erwartung |
|-----|---|---|---|
| E01 | `sl-change` → POST `/event` `{event:"change",params:{value:string}}` | Dispatch `sl-change` nach Wert-Änderung | `body.event === "change"`, `params.value === "blue"` |

## W — writeTo Write-Back (P204 / ADR 0027 — gemessen, keine Verdrahtung)

| ID  | Beschreibung | Aktion | Erwartung |
|-----|---|---|---|
| W01 | `value=store(x).color` UND `writeTo=store(x).color`: Auswahl schreibt per-client in den Store; ZWEITER gebundener `ui-text` ändert sich live | Dispatch `sl-change` mit `value="blue"` | Textinhalt `red`→`blue` (SSE), ohne function-Knoten. Radio hat keine Submit-Geste → schreibt bei `change` unabhängig vom `writeTrigger`. |
