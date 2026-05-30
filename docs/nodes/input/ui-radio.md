# `ui-radio`

## Zusammenfassung

Rendert eine Radio-Gruppe — genau eine Option wählbar.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `label`
- `value`: Binding auf den gewählten Wert
- `options`: statische Liste von `{ label, value }` oder Binding auf ein Array

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Radio N"`
- `orientation`: `horizontal | vertical`. Default: `vertical`
- `disabled`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `change` | `event: "change"`, `value`, `clientId` |
