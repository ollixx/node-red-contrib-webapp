# Testkatalog: ui-radio

> Format gemäß `.ai/agents/node-testing.md`. P127 (ADR 0012 — Binding-Ubiquität).

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

## E — Events

| ID  | Beschreibung | Aktion | Erwartung |
|-----|---|---|---|
| E01 | `sl-change` → POST `/event` `{event:"change",params:{value:string}}` | Dispatch `sl-change` nach Wert-Änderung | `body.event === "change"`, `params.value === "blue"` |
