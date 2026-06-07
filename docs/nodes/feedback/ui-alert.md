# `ui-alert`

## Zusammenfassung

Rendert eine farbige Hinweisleiste für Info-, Warn-, Fehler- oder Erfolgsmeldungen.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `message`: Binding auf den Meldungstext. typedInput mit allen Binding-Typen `literal | state | query | routeParam | msg | flow | global | jsonata | env | store` (P67). Typ `store` referenziert einen `ui-store`-Knoten derselben App per ID; der Wert wird zur Laufzeit über dessen `statePath` aufgelöst (robust gegen `statePath`-Umbenennungen). Back-Compat: ein Legacy-`messagePath` wird als `state`-Binding eingelesen.

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Alert N"`
- `severity`: semantische Ebene-2-Variante (`SEVERITY_VARIANTS`). Vokabular: `primary | success | warning | danger | neutral | info` (`info` ist ein Alias von `primary`). Default: `info` (= `primary`). Vokabular siehe [theming.md](../concepts/theming.md). (P49b: Legacy-Wert `error` wird vom Schema abgelehnt; der Serializer mappt ihn weiterhin gracefully auf `danger` für ältere deployed Flows.)
- `title`: optionale Überschrift, ebenfalls ein typedInput-Binding (gleiche Typen wie `message`, inkl. `store`) (P67). Ein leerer Literal-Wert entfällt.
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
