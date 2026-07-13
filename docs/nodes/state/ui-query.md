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
| `params` | „Params Store" | Node-Picker-Dialog (Preset Stores) | optional | Referenz auf einen **externen, geteilten** `ui-store` derselben App, der die Abfrageparameter (Seite, Sortierung, Suchbegriff) hält. **Optionaler Override:** ist das Feld **leer**, nutzt die Query ihren **impliziten per-Query Params-Store** (neuer Default, ADR 0030 — siehe [Impliziter Params-Store](#impliziter-params-store-adr-0030)); ist es **gesetzt**, teilt die Query die Params über den externen Store (wie bisher). In beiden Fällen **beobachtet** die Query den Store und feuert bei Änderung einen Refresh am **Out-Port** — siehe [Reaktives Paging](#reaktives-paging--params-store--out-port-refresh). |
| `debounceMs` | „Debounce (ms)" | Zahlfeld | optional | Verzögerung (ms), mit der schnelle `params`-Änderungen für den Out-Port-Refresh gebündelt werden (Such-Tippen). Leer / `0` = sofort (Default). |
| `refreshAction` | „Refresh Action" | Node-Picker-Dialog (Preset Actions) | optional | Referenz auf eine `ui-action` derselben App, die **manuell** einen Query-Refresh auslöst (Zusatz-Trigger neben dem `params`-Store). |

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

1. Ein **Auslöser** (typisch `ui-route` `onEnter`, ein `ui-action`-`refresh` oder
   ein `params`-Store-Wechsel) erreicht den **In-Port** der `ui-query`.
2. Die Query **reicht den Auslöser durch** an ihren **Out-Port** (nur Trigger/
   `refresh` — **nicht** `data`/`error`, s. Terminal-Regel unten).
3. Dahinter liegt die **eigentliche Datenquelle** (DB-/HTTP-/`function`-Knoten).
4. Deren Ergebnis wird als `msg.ui.query.data` (mit passendem `queryPath`)
   **zurück an den In-Port** der **selben** `ui-query` geschickt.
5. Der Knoten legt die Daten unter `ui.queries.<queryPath>` ab und pusht einen
   frischen Snapshot — die `data`-Rückgabe ist **terminal** und wird **nicht**
   erneut am Out-Port emittiert (sonst Schleife). Jede `query:<queryPath>`-Bindung
   aktualisiert sich live.

### Vollständiges Wiring-Beispiel

> **Skizze:** [assets/ui-query-feeds-ui-list.svg](assets/ui-query-feeds-ui-list.svg)
> — der volle Pfad `ui-route → ui-query → Datenquelle → Shaper → ui-list`. Die
> **`data`-Rückgabe ist terminal** (absorbiert + SSE-Push, **kein** Re-Emit am
> Out-Port — Schleifenschutz, s. [Output](#output)). Nötige Knoten: `ui-app`,
> `ui-route`, `ui-query`, eine Datenquelle (DB/HTTP/`function`), ein
> Shaper-`function` (Rohzeilen → ui-list-Item-Schema) und die `ui-list`
> (`items = query:<queryPath>`).

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
- **Push-/Refresh-Format:** `msg.ui.query` mit `queryPath` +
  `data`/`error`/`refresh` (+ optional `totalCount`/`pageCount` für Paging).
- **Reaktives Refresh:** ist ein `params`-Store gesetzt, feuert die Query bei
  dessen Änderung einen Out-Port-Refresh mit `msg.ui.query.params`; `debounceMs`
  bündelt Such-Tippen.
- **Lesen:** Daten über `query:<queryPath>`, Ladezustand über die reservierten
  Unterpfade `query:<queryPath>.loading` / `.error` / `.updatedAt` /
  `.totalCount` / `.pageCount`.
- **Link** auf die ausführliche Doku (später ggf. Wiki):
  `https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/state/ui-query.md`.

## Input

Der In-Port akzeptiert eine `msg.ui.query`, um Daten zu pushen oder einen
Refresh auszulösen ([messages.md](../concepts/messages.md)):

```
msg.ui.query.queryPath   = "customers.list"   ← muss zum Knoten passen
msg.ui.query.data        = [...]              ← neue Daten (optional)
msg.ui.query.totalCount  = 42                 ← (Paging) Gesamtzahl, optional neben data
msg.ui.query.pageCount   = 5                  ← (Paging) Seitenzahl, optional neben data
msg.ui.query.etag        = "..."              ← optional, für Caching
msg.ui.query.refresh     = true               ← Refresh-Signal ohne neue Daten
msg.ui.query.params      = { page, … }        ← vom Out-Port-Refresh getragen (reaktiv)
msg.ui.clientId          = <optional: gezielter Push>
```

- **Was passiert:** Eine `data`- oder `error`-Message ist **terminal** — sie legt
  Daten/Fehler unter dem `queryPath` ab und pusht an die verbundenen Clients
  (gezielt bei gesetztem `clientId`, sonst Broadcast) und wird **nicht** am
  Out-Port wiederholt (siehe [Output](#output) — sonst Endlosschleife). Eine
  `refresh`/`loading`-Message setzt den Ladezustand **und** läuft als Auslöser
  weiter (Out-Port).
- **Validierung:** keine fachlichen Verben über die `queryPath`-Zuordnung hinaus.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe — so kann der Knoten transparent zwischen
  dem auslösenden Event und der Datenquelle liegen.
- **Framework-Fehler** werden gemäß [logs-errors.md](../concepts/logs-errors.md)
  als strukturierter Fehler gemeldet.

## Output

Der Out-Port trägt **nur Auslöser** Richtung Datenquelle — die **Trigger-/
Refresh-Durchreichung**: ein `onEnter`/Action-Trigger, ein `refresh`-Signal oder
der reaktive `params`-Out-Port-Refresh. Dahinter verdrahtet der App-Autor die
eigentliche Datenquelle (DB-Node, HTTP-Request etc.) und schickt das Ergebnis als
`msg.ui.query.data` zurück an den In-Port.

> **Terminal-Regel (Schleifenschutz):** Eine eingehende Message, die **`data`
> oder `error`** für diesen `queryPath` trägt, ist die **Rückgabe** der
> Datenquelle — sie wird **absorbiert** (State + Push) und **NICHT** erneut am
> Out-Port emittiert. Würde sie durchgereicht, ginge sie zurück an die
> Datenquelle → erneute Rückgabe → **Endlosschleife**. Nur Trigger/`refresh`/
> nicht-erkannte Messages passieren den Out-Port; `data`/`error` enden hier.

**Antizipierte Wiring-Szenarien:**
- `ui-route` `onEnter` → `ui-query` (Trigger-Durchreichung am Out-Port) → DB/HTTP
  → zurück an den In-Port mit `msg.ui.query.data` (**terminal**, kein Re-Emit).
- `params`-Store ändert sich → reaktiver Refresh → neue Daten an die gebundene
  `ui-table`.

## Impliziter Params-Store (ADR 0030)

Folgt [ADR 0030](../../adr/0030-ui-query-implicit-per-query-params-store.md):
**jede `ui-query` besitzt implizit ihren eigenen Params-Store** — **kein extra
Knoten, kein Wiring**. Die Params leben in einem **per-client**-Slice unter
`ui.queries.<queryPath>.params` (per-client über `clientId`), direkt neben den
Query-Daten (`.data`) und dem Ladezustand.

**Adressierung wie jeder Store — über die Query-ID.** Ein `store`-Bezug, der auf
die **`ui-query`-Knoten-ID** zeigt, löst auf genau diesen Params-Slice auf. Die
Knoten-ID ist der „Store", der Sub-Pfad ist relativ zu `params`
([ADR 0013](../../adr/0013-store-binding-subpath.md): id + einstufiger Sub-Pfad).
Konkret schreibt/liest `store(<queryId>).page` den Wert unter
`ui.queries.<queryPath>.params.page`. Das gilt **konsistent in allen drei**
Store-Konsumenten:

- **`ui-store-action`** (schreiben) — z. B. `set page=2` auf die Query.
- **`ui-store-read`** (lesen) — die aktuellen Params der Query auslesen.
- **`store`-Value-Bindings** (Anzeige) — z. B. ein `ui-text` bindet
  `store(<queryId>).page`.

**Store-Picker.** Das `stores`-Preset (Node-Picker in `ui-store-action` /
`ui-store-read` und die `store`-typedInputs) listet die impliziten
Query-Params-Ziele **neben** den echten `ui-store`-Knoten, sichtbar
unterscheidbar als **„Query &lt;Name&gt; · Params"**. Die Auswahl speichert die
**Query-ID** als Referenz.

**Reaktiver Refresh.** Eine Änderung am impliziten Params-Slice (z. B. via
`ui-store-action set page=2` auf die Query) feuert den Out-Port-Refresh der Query
**genau wie ein expliziter `params`-Store** (P161-Mechanismus, siehe unten) — mit
den aktuellen Params am `msg.ui.query.params`.

**Override.** Das explizite `params`-Feld bleibt **optional**: **gesetzt** ⇒
externer, geteilter `ui-store` (Params über mehrere Queries teilen, wie bisher);
**leer** ⇒ impliziter per-Query-Store (neuer Default). Bestehende Flows mit
explizitem `params`-Store brechen nicht.

```text
[Button] → [ui-store-action • store=<queryId>, set path=page value=2]
                                     │  (Params-Änderung, per-client)
                                     ▼
                               ui-query re-fetcht (Out-Port-Refresh + params)
```

## Reaktives Paging — `params`-Store → Out-Port-Refresh

Folgt [ADR 0016](../../adr/0016-ui-query-trigger-model-visible-no-auto-fire.md):
**jeder Fetch hängt an einer sichtbaren Ursache** — es gibt **kein**
autonomes Selbst-Feuern bei Client-Ankunft. Der **Initial-Load** läuft über den
`route onEnter → ui-query`-Wire (ADR 0016 §2). Der **Refresh** (Paging,
Sortierung, Suche) läuft über die **deklarierte `params`-Referenz** (ADR 0016 §3)
— eine konfigurations-sichtbare reaktive Abhängigkeit, keine versteckte Magie.

Der reaktive Loop:

1. Ein **`params`-Store** hält `{ page, pageSize, sort?, search? }`.
2. Die `ui-query` referenziert diesen Store im `params`-Feld und **beobachtet** ihn.
3. Ändert sich der Store, **emittiert die Query einen Refresh am Out-Port** —
   `msg.ui.query = { queryPath, refresh: true, params: <aktueller Store-Wert> }`
   — und setzt ihren Ladezustand auf `loading` (Snapshot-Push, damit ein
   `query:<path>.loading`-gebundener Spinner sofort erscheint). Bei gesetztem
   `clientId` trägt die Message ihn weiter (per-client, P15).
4. Der **verdrahtete Fetch** (DB/HTTP/`function`) liest `msg.ui.query.params`,
   lädt die passende Seite und schickt `msg.ui.query = { queryPath, data, totalCount }`
   zurück an den **In-Port**.
5. Die Query legt `data` **und** `totalCount`/`pageCount` unter
   `ui.queries.<queryPath>` ab und pusht den Snapshot.
6. **„Next Page"** schreibt `page+1` in den `params`-Store → Schritt 3 feuert →
   neue Daten. **Kein Loop:** die Datenrückgabe verändert die Params nicht.

**Debounce.** Ist `debounceMs > 0` gesetzt, werden schnelle `params`-Änderungen
gebündelt — nur die **letzte** Änderung löst (nach Ablauf) einen Out-Port-Refresh
mit dem aktuellen Params-Wert aus. Default (`0` / leer): sofort.

**`refreshAction`** bleibt der **manuelle** Zusatz-Trigger; der reaktive Trigger
ist die Query selbst (Out-Port), **kein** separater `ui-action`-Knoten.

### Wiring-Beispiel (Paging-Loop)

```text
ui-pagination ──"Next Page"──▶ params-Store {page,pageSize}
                                     │  (Store-Änderung)
                                     ▼  beobachtet
                               ┌───────────────┐  Out-Port    ┌──────────────┐
                               │  ui-query     │ ────────────▶│  Datenquelle │
                               │ params: Store │  refresh +   │ liest        │
                               │ queryPath:list│  params      │ params.page  │
                               └──────▲────────┘              └──────┬───────┘
   ui-table  rows = query:list.data         msg.ui.query =          │
   ui-pagination total = query:list.totalCount  {queryPath, data,   │
                                                  totalCount} ◀──────┘
                                                  (zurück an In-Port)
```

Die `function`-Zeile der Datenquelle:

```js
const page = (msg.ui.query.params && msg.ui.query.params.page) || 1;
const { rows, total } = loadPage(page); // dein DB-/HTTP-Zugriff
msg.ui = { query: { queryPath: "list", data: rows, totalCount: total } };
return msg; // → an den In-Port der ui-query zurück
```

## Ladezustand und Lese-Konvention

Eine Query hält im Client-State unter `ui.queries.<queryPath>` eine
**Lebenszyklus-Hülle** `{ data, loading, error, updatedAt, status, totalCount?, pageCount? }`:

- `data` — zuletzt erfolgreich geladene Daten
- `loading` — `true`, während gerade geladen wird
- `error` — Fehlermeldung, wenn das Laden fehlschlug (sonst `undefined`)
- `updatedAt` — Timestamp des letzten erfolgreichen Ladevorgangs
- `status` — `idle` | `loading` | `success` | `error`
- `totalCount` — (Paging) Gesamtzahl der Treffer, vom Fetch neben `data`
  mitgeschickt; speist `ui-pagination` `total`. Ein reiner `data`-Push ohne
  `totalCount` lässt den letzten bekannten Wert stehen.
- `pageCount` — (Paging, optional) Anzahl der Seiten, analog `totalCount`.

**Gelesen wird über die `query`-Binding-Art — mit einer festen Konvention
(eindeutig, früher widersprüchlich):**

| Bindung | liefert |
|---|---|
| `query:<queryPath>` | die **DATEN** (`data`) — der häufigste Fall |
| `query:<queryPath>.loading` | das Lade-Flag |
| `query:<queryPath>.error` | die Fehlermeldung |
| `query:<queryPath>.updatedAt` | den Timestamp |
| `query:<queryPath>.status` | den Status-String |
| `query:<queryPath>.totalCount` | die Gesamtzahl der Treffer (Paging) |
| `query:<queryPath>.pageCount` | die Anzahl der Seiten (Paging) |

> `query:<queryPath>` zeigt **direkt auf die Daten**, nicht auf die Hülle — eine
> gebundene `ui-table` mit `rows = query:customers.list` bekommt also das
> Array selbst. Der Ladezustand wird über die **reservierten Unterpfade**
> `.loading` / `.error` / `.updatedAt` / `.status` / `.totalCount` / `.pageCount`
> gelesen. Die reservierten
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
  `params`-Store referenziert und lösen die Query reaktiv neu aus. Ohne
  explizites `params`-Feld nutzt die Query ihren **impliziten per-Query
  Params-Store** (`ui.queries.<queryPath>.params`, per-client), adressierbar über
  die Query-ID — siehe [Impliziter Params-Store](#impliziter-params-store-adr-0030).

## Referenzen

- [`ui-app`](../structure/ui-app.md) — Parent und Routing-Kontext
- [`ui-store`](ui-store.md) — Zustand und `params`-Store (Abgrenzung)
- [stores.md](../concepts/stores.md) — `query`-Binding
- [messages.md](../concepts/messages.md) — `msg.ui.query`-Format
- [multi-user.md](../concepts/multi-user.md) — `clientId`-Routing
- [logs-errors.md](../concepts/logs-errors.md) — strukturierte Fehler

## Offene Punkte

- ~~Wie Paging im Ladezustand abgebildet wird (`totalCount`, `pageCount`).~~
  **Geklärt (P161):** `totalCount`/`pageCount` leben in der Lebenszyklus-Hülle
  neben `data` und sind über `query:<queryPath>.totalCount` / `.pageCount`
  bindbar — siehe [Reaktives Paging](#reaktives-paging--params-store--out-port-refresh).
- ~~Ob die Query bei Parameter-Änderung sofort oder mit Debounce neu lädt.~~
  **Geklärt (P161):** Default sofort; optionales `debounceMs`-Feld bündelt
  Such-Tippen.
- Caching/Stale-While-Revalidate über das ETag-Konzept hinaus ist noch nicht
  modelliert.
