# `ui-list`

## Zusammenfassung

Rendert eine strukturierte Liste mit einem Item-Slot der pro Datensatz wiederholt wird.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `items`: Binding auf ein Array von Objekten

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"List N"`
- `variant`: `default | divided | compact`. Default: `default`
- `events`: Mehrfachauswahl — `itemClick`, `itemSelect`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Besonderheiten

- Der Item-Slot wird pro Eintrag in `items` wiederholt.
- View-Knoten die in den Item-Slot gemountet werden können über `itemData.<field>` auf die Felder des jeweiligen Eintrags zugreifen.
- Das ist das `ui-list`-Äquivalent des `rowData`-Konzepts bei `ui-table`. Siehe [ui-table.md](../display/ui-table.md) für das Konzept.

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `itemClick` | `event: "itemClick"`, `itemIndex`, `itemData`, `clientId` |
