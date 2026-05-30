# `ui-slider`

## Zusammenfassung

Rendert einen Schieberegler für numerische Werte.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `value`: Binding auf einen numerischen Wert

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Slider N"`
- `label`
- `min`. Default: `0`
- `max`. Default: `100`
- `step`. Default: `1`
- `showValue`: Aktuellen Wert neben dem Slider anzeigen
- `disabled`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`). Format siehe [messages.md](messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `change` | `event: "change"`, `value`, `clientId` |
