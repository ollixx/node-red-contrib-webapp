# `ui-alert`

## Zusammenfassung

Rendert eine farbige Hinweisleiste für Info-, Warn-, Fehler- oder Erfolgsmeldungen.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `message`: Binding auf den Meldungstext

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Alert N"`
- `severity`: `info | warning | error | success`. Default: `info`
- `title`: optionale Überschrift
- `dismissible`: Nutzer kann die Meldung schließen
- `visible`: Binding auf Boolean — steuert Sichtbarkeit
- `order`
- layoutabhängige Child-Props. Details in [layout.md](layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `dismiss` | `event: "dismiss"`, `clientId` |
