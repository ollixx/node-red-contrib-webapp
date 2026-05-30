# `ui-icon`

## Zusammenfassung

Rendert ein Icon per Name. Icon-Set-agnostisch — das Renderer-Backend bestimmt welches Icon-Set genutzt wird.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `icon`: Icon-Name (z.B. `"check"`, `"trash"`, `"user"`)

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Icon N"`
- `size`: `xs | sm | md | lg | xl`. Default: `md`
- `color`: Token-Farbe oder CSS-Wert
- `order`
- layoutabhängige Child-Props. Details in [layout.md](layout.md).

## Besonderheiten

- Das Renderer-Backend bestimmt welches Icon-Set verwendet wird (z.B. Material Icons, Heroicons, Lucide).
- Icon-Namen sollten aus einem gemeinsamen semantischen Vokabular kommen damit Backend-Wechsel ohne Flow-Änderungen möglich sind.
- Offene Frage: Wie wird das Icon-Vokabular standardisiert? Alias-Mapping pro Backend?

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](messages.md).

## Output

Kein Output.
