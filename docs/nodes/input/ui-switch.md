# `ui-switch`

## Zusammenfassung

Rendert einen Toggle-Switch für Boolean-Zustände.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `value`: Binding auf einen Boolean-Wert

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Switch N"`
- `label`: beschriftung neben dem Switch
- `labelOn`: Text wenn aktiv (z.B. "An")
- `labelOff`: Text wenn inaktiv (z.B. "Aus")
- `disabled`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `change` | `event: "change"`, `checked`, `clientId` |
