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
- `severity`: semantische Ebene-2-Variante (`SEVERITY_VARIANTS`). Vokabular: `primary | success | warning | danger | neutral | info` (`info` ist ein Alias von `primary`). Default: `info` (= `primary`). Vokabular siehe [theming.md](../concepts/theming.md). (P49b: Legacy-Wert `error` wird vom Schema abgelehnt; der Serializer mappt ihn weiterhin gracefully auf `danger` für ältere deployed Flows.)
- `title`: optionale Überschrift
- `dismissible`: Nutzer kann die Meldung schließen
- `visible`: Binding auf Boolean — steuert Sichtbarkeit
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `dismiss` | `event: "dismiss"`, `clientId` |
