# `ui-datepicker`

## Zusammenfassung

Rendert ein Datums- oder Datum+Uhrzeit-Eingabefeld.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `label`
- `value`: Binding auf einen ISO-8601-String

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Datepicker N"`
- `mode`: `date | datetime | time`. Default: `date`
- `min`: frühestes erlaubtes Datum
- `max`: spätestes erlaubtes Datum
- `placeholder`
- `disabled`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `change` | `event: "change"`, `value` (ISO-8601), `clientId` |
