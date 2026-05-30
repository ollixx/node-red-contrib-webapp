# `ui-progress`

## Zusammenfassung

Rendert einen Fortschrittsbalken oder Spinner für Ladezustände.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Progress N"`
- `variant`: `bar | spinner | circular`. Default: `bar`
- `value`: Binding auf 0–100. Fehlt der Wert: indeterminate (endlos animiert)
- `label`: Beschriftung neben dem Balken
- `showValue`: Prozentzahl anzeigen
- `order`
- layoutabhängige Child-Props. Details in [layout.md](layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](messages.md).

## Output

Kein Output.
