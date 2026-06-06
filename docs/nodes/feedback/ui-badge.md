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
- `displayType`: Darstellungsform (KEIN semantischer Variant) — `count | dot | status`. Default: `count`. Siehe [theming.md → Variant vs. displayType](../concepts/theming.md).
- `severity`: semantische Ebene-2-Variante des Badge (`SEVERITY_VARIANTS`). Vokabular: `primary | success | warning | danger | neutral | info` (`info` ist ein Alias von `primary`). Default: `neutral`. Vokabular siehe [theming.md](../concepts/theming.md). (P49b: Legacy-Werte `default` und `error` werden vom Schema abgelehnt; der Serializer mappt sie weiterhin gracefully auf `neutral`/`danger` für ältere deployed Flows.)
- `max`: Maximalwert — darüber wird `{max}+` angezeigt. Default: `99`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

Kein Output.
