# `ui-query`

## Zusammenfassung

Beschreibt eine benannte geladene Datenquelle für die UI.

Aktuelles MVP-Verhalten:
- Preview initialisiert Query-Statusfelder unter `ui.queries.<id>`.
- `refreshAction` verknüpft eine Action-ID mit Query-Refresh-Metadaten.
- Als Node-RED-Node reicht `ui-query` Nachrichten durch.

## Abhängigkeiten

**Parent-Knoten:**
- Keiner. `ui-query` ist ein unabhängiger State-Knoten.

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-action` über `refreshAction`
- Stellt Daten als Query-Binding für `ui-table` bereit (über `rows`-Binding)

## Editor

**Pflichtfelder:**
- `id`
- `queryPath`

**Optionale Felder:**
- `source`
- `refreshAction`

## Input

Als Node-RED-Node reicht `ui-query` Nachrichten durch.

## Output

Als Node-RED-Node reicht `ui-query` Nachrichten durch.

## Besonderheiten

- Es gibt noch kein explizites Modell für Laden, Fehler, Stale-Daten, Parameter oder Caching.
- `source` ist bisher kaum semantisch belegt und muss entweder klar definiert oder entfernt werden.
