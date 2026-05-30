# `ui-textarea`

## Zusammenfassung

Rendert ein mehrzeiliges Texteingabefeld.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `label`
- `value`: Binding auf den Textwert

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Textarea N"`
- `placeholder`
- `rows`: sichtbare Zeilenzahl. Default: `3`
- `maxLength`
- `disabled`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`, `focus`, `reset`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `change` | `event: "change"`, `value`, `clientId` |
| `submit` | `event: "submit"`, `value`, `clientId` |
