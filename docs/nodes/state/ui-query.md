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

> **Kein `previewData`/Seed-Feld.** Eine Query hat **keinen** Demo-Shortcut aus
> der Knoten-Konfiguration — das frühere `previewData`-Feld wurde in **P32**
> entfernt (es gibt kein Editor-Feld mehr). Der **verdrahtete** Weg (siehe
> [Verdrahtungs-Pflicht](#verdrahtungs-pflicht--keine-daten-ohne-wiring)) ist
> der **einzige** Weg, Daten in eine Query zu bekommen. Eine frisch deployte,
> noch nicht befüllte Query ist **leer** (`status: "idle"`, `data` undefiniert)
> — das ist *by design*, kein Fehler.

## Verdrahtungs-Pflicht — keine Daten ohne Wiring

`ui-query` **lädt nichts selbst.** Der Knoten ist Deklaration + Zustands-Halter:
er beschreibt *wo* (`queryPath`) und *in welchem Ladezustand* Daten liegen — die
Beschaffung verdrahtet der App-Autor. **Ohne Wiring bleibt die Query leer.** Das
ist die Erklärung hinter dem „alles leer"-Ersteindruck.

Der eine, verbindliche Datenpfad:

1. Ein Auslöser (typisch `ui-route` `onEnter`, ein `ui-action`-`refresh` oder ein
   `params`-Store-Wechsel) erreicht den **In-Port** der `ui-query`.
2. Die Query **reicht die Message durch** (Pass-Through) an ihren **Out-Port**.
3. Dahinter liegt die **eigentliche Datenquelle** (DB-/HTTP-/`function`-Knoten).
4. Deren Ergebnis wird als `msg.ui.query.data` (mit passendem `queryPath`)
   **zurück an den In-Port** der **selben** `ui-query` geschickt.
5. Der Knoten legt die Daten unter `ui.queries.<queryPath>` ab und pusht einen
   frischen Snapshot an die Clients — jede `query:<queryPath>`-Bindung
   aktualisiert sich live.

### Vollständiges Wiring-Beispiel

```text
ui-route (onEnter)                                   ┌─────────────────────────┐
      │  msg (trigger)                                │  ui-table               │
      ▼                                               │  rows = query:customers.list
┌───────────────┐  Pass-Through   ┌──────────────┐    └─────────────▲───────────┘
│  ui-query     │ ───────────────▶│  Datenquelle │                  │ Snapshot-Push
│ queryPath:    │                 │ (DB / HTTP / │                  │ (SSE)
│ customers.list│                 │  function)   │                  │
└──────▲────────┘                 └──────┬───────┘          ui.queries.customers.list
       │  msg.ui.query.data              │                          ▲
       └─────────────────────────────────┘  msg.ui = {              │
            zurück an den In-Port              query: {             │
                                                 queryPath: "customers.list",
                                                 data: [ … ]        │
                                               }                    │
                                             }  ──────────────────────┘
```

Die `function`-Knoten-Zeile hinter der Datenquelle, die das Ergebnis
zurückschickt:

```js
msg.ui = { query: { queryPath: "customers.list", data: msg.payload } };
return msg; // → an den In-Port der ui-query zurückverdrahten
```

Ein **Fehler** beim Laden wird genauso zurückgeschickt — nur mit `error` statt
`data`:

```js
msg.ui = { query: { queryPath: "customers.list", error: "Laden fehlgeschlagen" } };
return msg;
```

### Inline-Hilfe (HTML)

Der `data-help-name="ui-query"`-Hilfetext im Editor soll **knapp, aber
ausreichend** sein und vor allem den leeren Erstkontakt erklären:

- **Zweck:** benannte, *geladene* Datenquelle + Ladezustand unter
  `ui.queries.<queryPath>` — **read-only** im UI (zum eigenen, veränderbaren
  Zustand → [`ui-store`](ui-store.md)).
- **„Leer ist normal":** ohne Wiring kommen keine Daten — der Knoten lädt nichts
  selbst. Kurzer Verweis auf die Verdrahtungs-Pflicht.
- **Push-/Refresh-Format:** `msg.ui.query` mit `queryPath` + `data`/`error`/`refresh`.
- **Lesen:** Daten über `query:<queryPath>`, Ladezustand über die reservierten
  Unterpfade `query:<queryPath>.loading` / `.error` / `.updatedAt`.
- **Link** auf die ausführliche Doku (später ggf. Wiki):
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

## Ladezustand und Lese-Konvention

Eine Query hält im Client-State unter `ui.queries.<queryPath>` eine
**Lebenszyklus-Hülle** `{ data, loading, error, updatedAt, status }`:

- `data` — zuletzt erfolgreich geladene Daten
- `loading` — `true`, während gerade geladen wird
- `error` — Fehlermeldung, wenn das Laden fehlschlug (sonst `undefined`)
- `updatedAt` — Timestamp des letzten erfolgreichen Ladevorgangs
- `status` — `idle` | `loading` | `success` | `error`

**Gelesen wird über die `query`-Binding-Art — mit einer festen Konvention
(eindeutig, früher widersprüchlich):**

| Bindung | liefert |
|---|---|
| `query:<queryPath>` | die **DATEN** (`data`) — der häufigste Fall |
| `query:<queryPath>.loading` | das Lade-Flag |
| `query:<queryPath>.error` | die Fehlermeldung |
| `query:<queryPath>.updatedAt` | den Timestamp |
| `query:<queryPath>.status` | den Status-String |

> `query:<queryPath>` zeigt **direkt auf die Daten**, nicht auf die Hülle — eine
> gebundene `ui-table` mit `rows = query:customers.list` bekommt also das
> Array selbst. Der Ladezustand wird über die **reservierten Unterpfade**
> `.loading` / `.error` / `.updatedAt` / `.status` gelesen. Die reservierten
> Suffixe greifen **nur** für bekannte Query-Pfade — ein tieferer Pfad in die
> Daten (z. B. `query:customers.current.name`) bleibt unberührt.

Damit:

- `ui-table` `rows = query:customers.list` → zeigt die Zeilen.
- `ui-text` `value = query:customers.list.error` → zeigt eine Fehlermeldung.
- `ui-text` `value = query:customers.list.loading` → zeigt das Lade-Flag (z. B.
  als Bedingung für einen Spinner via `visibleIf`).

## Theming

`ui-query` rendert selbst nichts Sichtbares — es ist ein Datenquellen-Knoten. Die
Darstellung der Daten (und ihres Lade-/Fehlerzustands) übernehmen die gebundenen
View-Knoten; deren Theming ist backend-neutral. Siehe [theming.md](../concepts/theming.md).

## Abgrenzung: `ui-query` vs. `ui-store`

`ui-query` und `ui-store` bleiben **bewusst getrennte** Knoten (Owner-Entscheid).
Die Trennung ist scharf — wähle nach **Eigentümerschaft und Schreibrichtung**:

| | [`ui-store`](ui-store.md) | `ui-query` (diese Seite) |
|---|---|---|
| Was | **eigener, veränderbarer** Client-Zustand | **server-geladene** Daten, im UI **read-only** |
| Schreiben | ja — über `msg.ui.store`-Operationen; **Input-Controls schreiben in Stores** (zweiseitig) | **nein** — kein zweiter Schreibpfad; befüllt **nur** über das Fetch-Wiring (`msg.ui.query.data`) |
| Lesen | `store`-Binding (per Knoten-ID → `statePath`) bzw. `state` | `query`-Binding (`query:<queryPath>` = Daten; `.loading`/`.error`/`.updatedAt` = Ladezustand) |
| Ladezustand | keiner | `loading` / `data` / `error` / `updatedAt` / `status` |
| Beladung | Operationen aus dem Flow oder von Input-Controls | Fetch-Wiring (+ `params`-Store, `refreshAction`, ETag) |

**Faustregel:** Hält der Nutzer/das Formular den Wert (Entwurf, Auswahl, Toggle)
→ `ui-store`. Kommt der Wert vom Server und das UI zeigt ihn nur an (Liste,
Detaildatensatz, Suchergebnis) → `ui-query`. Es gibt in einer Query **keinen**
zweiten Schreibpfad — Mutationen laufen über den Flow zurück und kommen als neuer
`msg.ui.query.data`-Push wieder herein.

Siehe auch [stores.md](../concepts/stores.md) für das gemeinsame Binding-Vokabular.

## Besonderheiten

- **Abgrenzung kurz.** `ui-query` = geladene, read-only Daten **mit** Ladezustand;
  `ui-store` = eigener, veränderbarer Zustand (siehe Tabelle oben); `ui-action`
  ändert nur Interaktionszustand, keine Daten.
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
