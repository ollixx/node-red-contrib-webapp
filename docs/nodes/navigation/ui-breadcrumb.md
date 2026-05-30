# `ui-breadcrumb`

## Zusammenfassung

Rendert einen Navigationspfad der die aktuelle Position in der App-Hierarchie zeigt.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `items`: Binding auf ein Array von `{ label, path? }` — letztes Item ist die aktuelle Seite

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Breadcrumb N"`
- `separator`: Trennzeichen. Default: `/`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `navigate` | `event: "navigate"`, `path`, `clientId` |
