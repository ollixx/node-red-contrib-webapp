# `ui-badge`

## Zusammenfassung

Rendert einen kleinen Zähler oder Status-Indikator, typischerweise an einem anderen Element.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `value`: Binding auf Zahl oder String (z.B. Anzahl ungelesener Nachrichten)

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Badge N"`
- `variant`: `count | dot | status`. Default: `count`
- `severity`: `default | info | warning | error | success`. Default: `default`
- `max`: Maximalwert — darüber wird `{max}+` angezeigt. Default: `99`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](messages.md).

## Output

Kein Output.
