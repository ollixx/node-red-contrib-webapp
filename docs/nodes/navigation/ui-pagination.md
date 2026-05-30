# `ui-pagination`

## Zusammenfassung

Rendert Seiten-Navigationscontrols. Arbeitet direkt mit `ui-query` über einen Store zusammen.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht. Typischerweise im Footer-Slot einer `ui-table`.

## Editor

**Pflichtfelder:**
- `parent`
- `page`: Binding auf die aktuelle Seite (aus einem Store)
- `totalPages`: Binding auf die Gesamtseitenzahl (aus einer Query)

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Pagination N"`
- `pageSize`: Binding auf die Seitengröße
- `totalItems`: Binding auf die Gesamtanzahl der Einträge
- `showInfo`: "Einträge X–Y von Z" anzeigen. Default: `true`
- `variant`: `numbered | simple`. Default: `numbered`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `pageChange` | `event: "pageChange"`, `page`, `clientId` |
