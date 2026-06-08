# `ui-query`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-query` deklariert eine **benannte, geladene Datenquelle** für die UI. Sie
beschreibt *wo* die Daten im Client-State liegen (`queryPath`) und *welchen
Ladezustand* sie haben — nicht *wie* sie beschafft werden. Die eigentliche
Datenbeschaffung (DB, HTTP, …) verdrahtet der App-Autor hinter dem In-Port und
schickt das Ergebnis an den Knoten zurück. View-Knoten (z. B. `ui-table`) binden
sich über `query`-Bindings an die geladenen Daten.

## Einordnung

- **Parent:** genau eine `ui-app`. Die App ist der Routing-Kontext — sie bestimmt, an welche Clients Query-Daten und Lade-Events gesendet werden.
- **Kinder:** keine. `ui-query` wird nicht gemountet; er ist ein Datenquellen-Knoten.
- **Bezüge:** stellt Daten als `query`-Binding bereit (z. B. `query:customers.list`); kann seine Parameter über ein `params`-Store-Binding beziehen; kann eine `ui-action` als `refreshAction` referenzieren.
- **Rolle zur Laufzeit:** legt die Query-Daten und ihren Ladezustand unter `ui.queries.<queryPath>` im Client-State ab und pusht Updates an die Clients.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Query N`. |
| `parent` | „App" | Node-Picker-Dialog (Preset Apps) | **ja** | Die Parent-`ui-app`. Bestimmt den Routing-Kontext für Query-Daten und Lade-Events. |
| `queryPath` | „Query Path" | Textfeld | **ja** | Pfad, unter dem die Query-Daten im Client-State abgelegt werden. Bindings referenzieren ihn (z. B. `customers.list` → `query:customers.list`). Innerhalb derselben App eindeutig. |

### Gruppe „Daten"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `params` | „Params Store" | Node-Picker-Dialog (Preset Stores) | optional | Referenz auf einen `ui-store` derselben App, der die Abfrageparameter (Seite, Sortierung, Suchbegriff) hält. Die Query reagiert reaktiv auf Änderungen dieses Stores. |
| `refreshAction` | „Refresh Action" | Node-Picker-Dialog (Preset Actions) | optional | Referenz auf eine `ui-action` derselben App, die einen Query-Refresh auslöst. |
| `previewData` | „Preview Data (JSON)" | Textfeld (JSON, mehrzeilig) | optional | Deklarative Seed-Daten für Preview/Runtime. Werden unter dem ersten Segment von `queryPath` (dem Sammlungs-Root) eingehängt — Demo-Daten kommen so aus der Knoten-Konfiguration. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-query"`-Hilfetext im Editor soll **knapp, aber
ausreichend** sein: Zweck (benannte geladene Datenquelle, Ladezustand unter
`ui.queries.<queryPath>`), ein Hinweis auf das Push-/Refresh-Format
(`msg.ui.query`), die Bindung über `query:<queryPath>` und ein Link auf die
ausführliche Doku. Empfohlener Link (später ggf. Wiki):
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/state/ui-query.md`.

## Input

Der In-Port akzeptiert eine `msg.ui.query`, um Daten zu pushen oder einen
Refresh auszulösen ([messages.md](../concepts/messages.md)):

```
msg.ui.query.queryPath = "customers.list"   ← muss zum Knoten passen
msg.ui.query.data      = [...]              ← neue Daten (optional)
msg.ui.query.etag      = "..."              ← optional, für Caching
msg.ui.query.refresh   = true               ← Refresh-Signal ohne neue Daten
msg.ui.clientId        = <optional: gezielter Push>
```

- **Was passiert:** Eine `data`-Message legt die geladenen Daten unter dem
  `queryPath` ab und pusht sie an die verbundenen Clients (gezielt bei gesetztem
  `clientId`, sonst Broadcast). Eine `refresh`-Message signalisiert das Neuladen.
- **Validierung:** keine fachlichen Verben über die `queryPath`-Zuordnung hinaus.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe — so kann der Knoten transparent zwischen
  dem auslösenden Event und der Datenquelle liegen.
- **Framework-Fehler** werden gemäß [logs-errors.md](../concepts/logs-errors.md)
  als strukturierter Fehler gemeldet.

## Output

Der Out-Port **reicht die eingehende Message durch** — dahinter verdrahtet der
App-Autor die eigentliche Datenquelle (DB-Node, HTTP-Request etc.) und schickt
das Ergebnis als `msg.ui.query.data` zurück an den In-Port.

**Antizipierte Wiring-Szenarien:**
- `ui-route` `onEnter` → `ui-query` (Refresh-/Trigger-Durchreichung) → DB/HTTP →
  zurück an den In-Port mit `msg.ui.query.data`.
- `params`-Store ändert sich → reaktiver Refresh → neue Daten an die gebundene
  `ui-table`.

## Ladezustand

Eine Query hat immer einen Ladezustand im Client-State unter `ui.queries.<queryPath>`:

- `loading` — Daten werden gerade geladen
- `data` — zuletzt geladene Daten
- `error` — Fehlermeldung, wenn das Laden fehlschlug
- `updatedAt` — Timestamp des letzten erfolgreichen Ladevorgangs

View-Knoten wie `ui-table` binden sich an `data`; Ladeindikatoren oder
Fehlermeldungen lassen sich über `ui-text` mit Binding auf `loading` bzw.
`error` darstellen.

## Theming

`ui-query` rendert selbst nichts Sichtbares — es ist ein Datenquellen-Knoten. Die
Darstellung der Daten (und ihres Lade-/Fehlerzustands) übernehmen die gebundenen
View-Knoten; deren Theming ist backend-neutral. Siehe [theming.md](../concepts/theming.md).

## Besonderheiten

- **Abgrenzung.** `ui-query` beschreibt geladene Datenquellen und ihren
  Ladezustand; `ui-store` hält und verändert lokalen Zustand; `ui-action` ändert
  nur Interaktionszustand.
- **ETag-Caching.** Liefert eine Message einen `etag`, kann die Runtime einen
  unveränderten Wert vom Push ausschließen (der App-Autor weiß am besten, ob sich
  Daten geändert haben — DB-Timestamp, Version, Hash). Fehlt `etag`, wird immer
  gepusht.
- **Query-Parameter leben im Store.** Paging/Sortierung/Suche werden über einen
  `params`-Store referenziert und lösen die Query reaktiv neu aus.

## Referenzen

- [`ui-app`](../structure/ui-app.md) — Parent und Routing-Kontext
- [`ui-store`](ui-store.md) — Zustand und `params`-Store (Abgrenzung)
- [stores.md](../concepts/stores.md) — `query`-Binding
- [messages.md](../concepts/messages.md) — `msg.ui.query`-Format
- [multi-user.md](../concepts/multi-user.md) — `clientId`-Routing
- [logs-errors.md](../concepts/logs-errors.md) — strukturierte Fehler

## Offene Punkte

- Wie Paging im Ladezustand abgebildet wird (`totalCount`, `pageCount`), ist noch
  offen.
- Ob die Query bei Parameter-Änderung sofort oder mit Debounce neu lädt, ist noch
  nicht entschieden.
- Caching/Stale-While-Revalidate über das ETag-Konzept hinaus ist noch nicht
  modelliert.
