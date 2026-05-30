# `ui-checkbox`

## Zusammenfassung

Rendert eine einzelne Checkbox mit Boolean-Binding.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `label`
- `value`: Binding auf einen Boolean-Wert

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Checkbox N"`
- `disabled`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`). Format siehe [messages.md](messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `change` | `event: "change"`, `checked`, `clientId` |
