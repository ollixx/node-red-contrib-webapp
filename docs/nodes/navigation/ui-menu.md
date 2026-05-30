# `ui-menu`

## Zusammenfassung

Rendert ein Navigationsmenü für Sidebar oder Topbar.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht. Typischerweise in einem `app`-Layout-Slot (navbar, header).

## Editor

**Pflichtfelder:**
- `parent`
- `items`: Binding oder statische Liste von `{ label, path, icon?, children? }`

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Menu N"`
- `variant`: `sidebar | topbar | dropdown`. Default: `sidebar`
- `activeItem`: Binding auf den aktiven Pfad — wird aus der aktuellen Route abgeleitet
- `collapsed`: Binding auf Boolean — für einklappbare Sidebars
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `navigate` | `event: "navigate"`, `path`, `clientId` |
