# Testkatalog: ui-slider

> Format gemäß `.ai/agents/node-testing.md`. Aktualisiert für P126
> (ADR 0012 — Binding-Ubiquität).

## Tests (P126)

### Rendering

| ID  | Testziel |
|-----|----------|
| R01 | `sl-range`-Element ist sichtbar. |
| R02 | `min`, `max`, `step`-Attribute werden korrekt am `sl-range` gesetzt. |
| R03 | `label`-Prop setzt das `label`-Attribut am `sl-range`. |

### Value-Binding (kanonischer typedInput, literaler Default `number`)

| ID  | Testziel |
|-----|----------|
| V01 | Literales `number`-Binding setzt den Initialwert des Sliders. |
| V02 | `state`-Binding löst den Live-Wert aus dem Client-State auf. |
| V03 | Legacy `valuePath` wird migriert — Slider zeigt den korrekten Initialwert. |

### Disabled-Binding (Boolean-Zustand)

| ID  | Testziel |
|-----|----------|
| D01 | `disabled: { kind:"literal", value:true }` rendert `sl-range[disabled]`. |
| D02 | `disabled: { kind:"literal", value:false }` rendert `sl-range` ohne `disabled`-Attribut. |
| D03 | Store-Binding deaktiviert den Slider live, sobald der Store-Wert truthy wird. |

### Events

| ID  | Testziel |
|-----|----------|
| E01 | `sl-change` → POST `/event` mit `{ event:"change", params:{ value: number } }`. |
