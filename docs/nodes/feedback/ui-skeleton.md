# `ui-skeleton`

## Zusammenfassung

Rendert einen animierten Lade-Platzhalter der die Form des eigentlichen Inhalts imitiert.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `visible`: Binding auf Boolean — `true` = Skeleton sichtbar, `false` = Skeleton versteckt (Inhalt geladen)

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Skeleton N"`
- `variant`: `text | avatar | card | table`. Default: `text`
- `lines`: Anzahl simulierter Textzeilen (nur `variant: text`). Default: `3`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

Kein Output.
