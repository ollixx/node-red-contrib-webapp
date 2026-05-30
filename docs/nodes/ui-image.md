# `ui-image`

## Zusammenfassung

Rendert ein Bild mit Binding auf die Quelle, Alt-Text und optionalem Fallback.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `src`: Binding auf eine URL oder Base64-String

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Image N"`
- `alt`: Alt-Text für Barrierefreiheit
- `fallbackSrc`: Fallback-URL bei Ladefehler
- `width`: Breite (px oder %)
- `height`: Höhe (px)
- `fit`: `contain | cover | fill | none`. Default: `cover`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `error` | `event: "error"`, `src`, `clientId` |
