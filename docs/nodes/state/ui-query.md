# `ui-query`

## Zusammenfassung

Beschreibt eine benannte geladene Datenquelle für die UI.

Aktuelles MVP-Verhalten:
- Preview initialisiert Query-Statusfelder unter `ui.queries.<id>`.
- `refreshAction` verknüpft eine Action-ID mit Query-Refresh-Metadaten.
- Als Node-RED-Node reicht `ui-query` Nachrichten durch.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`: Pflicht. Die App ist der Routing-Kontext — sie bestimmt, an welchen Client Query-Daten und Lade-Events gesendet werden.

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-action` über `refreshAction`
- Stellt Daten als Query-Binding für `ui-table` bereit (über `rows`-Binding)

## Editor

**Pflichtfelder:**
- `parent`: Auswahl einer `ui-app`. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `queryPath`: Pfad unter dem die Query-Daten im Client-State abgelegt werden. Bindings in View-Knoten referenzieren diesen Pfad. Beispiel: `customers.list` → erreichbar als `query:customers.list` in Bindings.
  - Validierung: innerhalb einer App muss `queryPath` eindeutig sein

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Query N"` (fortlaufende Nummer aller ui-query-Knoten, startend bei 1)
- `refreshAction`: Auswahl eines `ui-action`-Knotens derselben App. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.

## Input

Akzeptiert eingehende Messages um Daten zu pushen oder einen Refresh auszulösen. Format siehe [messages.md](../concepts/messages.md):

```
msg.ui.query.queryPath  = "customers.list"
msg.ui.query.data       = [...]            ← neue Daten
msg.ui.query.etag       = "..."            ← optional, für Caching
msg.ui.query.refresh    = true             ← Refresh-Signal ohne Daten
msg.ui.clientId                            ← optional, gezielter Push
```

## Output

Reicht die eingehende Message durch — der App-Autor verdrahtet dahinter die eigentliche Datenquelle (DB-Node, HTTP-Request etc.) und schickt das Ergebnis zurück an den In-Port.

## Caching

Im MVP gibt es kein Caching. Jede eingehende Message wird direkt an alle verbundenen Clients gepusht, unabhängig davon ob sich die Daten geändert haben.

### Konzept für spätere Versionen: ETag-basiertes Caching

Die Runtime hält pro Query und Client den zuletzt gepushten Wert. Bevor ein Update gesendet wird, vergleicht sie einen mitgelieferten `etag`-Wert mit dem zuletzt gesendeten:

- **ETag unverändert**: kein Push, Client behält seinen aktuellen State.
- **ETag neu oder geändert**: Daten werden gepusht, neuer ETag gespeichert.

Der App-Autor liefert den ETag selbst mit — typischerweise ein DB-Timestamp, eine Versionsnummer oder ein Hash. Das ist bewusst so: der Flow-Autor weiß am besten ob sich Daten geändert haben, ohne dass das Framework teures Deep-Equal auf großen Listen machen muss.

```
msg.ui.query.queryPath  = "customers.list"
msg.ui.query.data       = [...]
msg.ui.query.etag       = "2026-05-30T08:12:00Z"   ← z.B. DB-Timestamp
```

Fehlt `etag`, wird immer gepusht (heutiges Verhalten als Fallback).

---

## Ladezustand

Eine Query hat immer einen Ladezustand, der im Client-State unter `ui.queries.<queryPath>` verfügbar ist:

- `loading`: Daten werden gerade geladen
- `data`: zuletzt geladene Daten
- `error`: Fehlermeldung, wenn das Laden fehlgeschlagen ist
- `updatedAt`: Timestamp des letzten erfolgreichen Ladevorgangs

View-Knoten wie `ui-table` binden sich an `data`. Ladeindikatoren oder Fehlermeldungen können über `ui-text` mit Binding auf `loading` bzw. `error` dargestellt werden.

## Paging, Filtern, Sortieren (Konzept für spätere Versionen)

Im MVP hat `ui-query` keine eigene Parameter-Logik. Für spätere Versionen ist folgender Ansatz vorgesehen:

**Query-Parameter leben im Store.** Ein `ui-store`-Knoten hält die aktuellen Abfrageparameter (Seite, Sortierung, Suchbegriff). Die Query referenziert diesen Store über ein `params`-Binding und wird automatisch neu ausgeführt, wenn sich der Store ändert.

```
ui-store: customersFilter
  statePath: customersFilter
  initialValue: { page: 1, pageSize: 20, sort: "name", search: "" }

ui-query: customers
  params: store:customersFilter   ← reagiert reaktiv auf Änderungen
```

Ändert der Nutzer den Suchbegriff in einem `ui-input`, schreibt das in `customersFilter`, die Query führt sich neu aus und `ui-table` zeigt das neue Ergebnis — ohne extra Flow-Logik.

**Messages als Escape-Hatch.** Parameter können alternativ per eingehender Message gesetzt werden (`msg.ui.query.params`). Das ist flexibler, aber nicht reaktiv — geeignet für server-getriggerte Abfragen.

**Offene Punkte:**
- Wie wird Paging im Ladezustand abgebildet (`totalCount`, `pageCount`)?
- Soll die Query bei Parameter-Änderung sofort oder mit Debounce neu laden?
- Caching und Stale-While-Revalidate sind noch nicht modelliert.
- `source` existiert im aktuellen Schema und Editor, hat aber keine implementierte Semantik — der Renderer ignoriert es, die Runtime speichert es nur durch. Das Feld sollte entfernt werden. (Tech Debt)
