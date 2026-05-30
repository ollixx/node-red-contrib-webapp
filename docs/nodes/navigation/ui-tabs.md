# `ui-tabs`

## Zusammenfassung

Rendert eine Tab-Leiste. Jeder Tab ist ein benannter Slot in den View-Knoten gemountet werden.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `tabs`: Liste von Tab-Definitionen `{ id, label }` — mindestens ein Tab

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Tabs N"`
- `activeTab`: Binding auf die ID des aktiven Tabs
- `variant`: `line | contained | pills`. Default: `line`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Slots

Für jeden Tab in `tabs` wird ein Slot `tab:<tabId>` erzeugt. View-Knoten mounten mit `parent: <tabsNodeId>/tab:<tabId>`.

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `tabChange` | `event: "tabChange"`, `tabId`, `clientId` |
