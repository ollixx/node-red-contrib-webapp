# `ui-avatar`

## Zusammenfassung

Rendert ein Benutzer-Avatar — Bild, Initialen oder Icon als Fallback.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Avatar N"`
- `src`: Binding auf eine Bild-URL
- `initials`: Binding auf einen String (z.B. `"MK"`) — Fallback wenn kein Bild
- `size`: `xs | sm | md | lg | xl`. Default: `md`
- `shape`: `circle | square`. Default: `circle`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Fallback-Reihenfolge

1. `src` → Bild laden
2. Ladefehler oder kein `src` → `initials` anzeigen
3. Kein `initials` → generisches User-Icon

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

Kein Output.
