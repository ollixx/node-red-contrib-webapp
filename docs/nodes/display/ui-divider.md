# `ui-divider`

## Zusammenfassung

Rendert eine visuelle Trennlinie zwischen Inhaltsbereichen.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Divider N"`
- `orientation`: `horizontal | vertical`. Default: `horizontal`
- `label`: optionaler Text in der Mitte der Linie
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

Kein Output.
