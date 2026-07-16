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

### writeTo Write-Back (P204 / ADR 0027 — gemessen, keine Verdrahtung)

| ID  | Testziel |
|-----|----------|
| W01 | `value=store(x).vol` UND `writeTo=store(x).vol`: Ziehen (`sl-change`, `value="73"`) schreibt per-client in den Store; ein ZWEITER an `store(x).vol` gebundener `ui-text` zeigt live (SSE, Textinhalt `10`→`73`), ohne function-Knoten. Slider hat keine Submit-Geste → schreibt bei `change` unabhängig vom `writeTrigger`; Sondermodell: Wert als numerischer String. |

## P237 — label Binding-Auflösung (Muster 4, ADR 0012)

Unit (`packages/runtime/test/p237-slider-label-binding.test.ts`):

| ID  | Testziel |
|-----|----------|
| B01 | state-gebundenes `label` → `sl-range[label]` = aufgelöster Wert (renderer→serializer); rot, wenn die Auflösung bricht. |
| B02 | Der rohe Binding-Pfad (`form.lbl`) leakt nicht ins `label`-Attribut; kein `[object Object]`. |
