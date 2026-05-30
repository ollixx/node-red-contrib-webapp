# `ui-empty-state`

## Zusammenfassung

Rendert einen strukturierten Platzhalter für leere Listen, fehlgeschlagene Ladevorgänge oder noch nicht vorhandene Inhalte.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `visible`: Binding auf Boolean — `true` = Empty State sichtbar

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Empty State N"`
- `icon`: Icon-Name
- `title`: Überschrift. Default: `"Keine Einträge"`
- `message`: beschreibender Text
- `action`: Auswahl einer `ui-action` — optionaler Call-to-Action-Button
- `actionLabel`: Beschriftung des CTA-Buttons
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

Kein Output.
