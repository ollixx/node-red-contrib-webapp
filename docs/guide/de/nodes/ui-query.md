# ui-query

Eine benannte, geladene Datenquelle für die UI — read-only, mit Ladezustand. Sie
lädt nichts selbst: den Fetch verdrahtest du.

> English: [../../nodes/ui-query.md](../../nodes/ui-query.md)

## Zweck

`ui-query` deklariert eine **benannte, geladene Datenquelle**. Sie beschreibt
*wo* die Daten im Client-State liegen (`queryPath`) und *welchen Ladezustand*
sie haben — nicht *wie* sie beschafft werden. Den eigentlichen Fetch (DB, HTTP,
…) verdrahtest du hinter ihrem In-Port und schickst das Ergebnis zurück an den
Knoten. View-Knoten binden sich über `query`-Bindings an die geladenen Daten.
Sie ist **read-only** im UI — für eigenen veränderbaren Zustand →
[`ui-store`](ui-store.md).

## Wann einsetzen

- Server-geladene, read-only Daten zeigen (Liste, Datensatz, Suchergebnis).
- Einen Spinner / eine Fehlermeldung aus `.loading` / `.error` der Query steuern.
- Nicht für nutzer-eigenen veränderbaren Zustand (Entwurf, Auswahl) — das ist
  [`ui-store`](ui-store.md).

> **„Leer ist normal."** Eine frisch deployte Query ist leer, bis du den Fetch
> verdrahtest — der Knoten lädt nichts von selbst.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Query N` |
| **App** | Die Parent-`ui-app` — Routing-Kontext für Query-Daten und Lade-Events. Pflicht. | App-Referenz | — |
| **Query Path** (`queryPath`) | Wo die Daten im Client-State liegen; Bindings referenzieren ihn (`customers.list` → `query:customers.list`). App-weit eindeutig. Pflicht. | Pfad | — |
| **Params Store** (`params`) | Optionale Referenz auf einen geteilten `ui-store` mit den Query-Params (Seite, Sortierung, Suche). Leer = die Query nutzt ihren **impliziten per-Query Params-Store**. In beiden Fällen feuert eine Params-Änderung einen Out-Port-Refresh. | Store-Referenz | leer (implizit) |
| **Debounce (ms)** (`debounceMs`) | Verzögerung zum Bündeln schneller Params-Änderungen (Such-Tippen) vor dem Out-Port-Refresh. Leer / `0` = sofort. | Zahl | `0` |
| **Refresh Action** (`refreshAction`) | Optionale `ui-action` derselben App, die manuell einen Refresh auslöst (Zusatz-Trigger neben dem Params-Store). | Action-Referenz | leer |

## Eingang

Der In-Port akzeptiert eine `msg.ui.query`, deren `queryPath` zu diesem Knoten
passt:

```
msg.ui.query.queryPath = "customers.list"   ← muss passen
msg.ui.query.data      = [...]              ← neue Daten (terminal — absorbiert, kein Re-Emit)
msg.ui.query.error     = "..."              ← Lade-Fehler (terminal)
msg.ui.query.refresh   = true               ← Refresh-Signal (läuft am Out-Port weiter)
msg.ui.query.totalCount / .pageCount        ← Paging, optional neben data
msg.ui.clientId        = <gezielter Push>
```

Eine `data` / `error`-Message ist **terminal**: sie wird abgelegt und an Clients
gepusht, nie am Out-Port wiederholt (Schleifenschutz). Eine `refresh` /
`loading`-Message setzt den Ladezustand **und** läuft am Out-Port weiter.
Unbekannte / fachfremde Messages werden unverändert durchgereicht, sodass der
Knoten transparent zwischen Auslöser und Fetch liegen kann.

## Ausgänge / Events

Der Out-Port trägt **nur Auslöser** Richtung Fetch (ein `refresh`, ein
`onEnter`-Trigger oder ein reaktiver Params-Refresh). Dahinter verdrahtest du die
echte Datenquelle und schickst das Ergebnis als `msg.ui.query.data` zurück an den
In-Port. `data` / `error` enden am In-Port (sie erreichen den Out-Port nicht).

**Lese-Konvention:** `query:<queryPath>` sind die **Daten**; `.loading` /
`.error` / `.updatedAt` / `.status` / `.totalCount` / `.pageCount` lesen den
Ladezustand.

## Beispiele

### 1. Ein verdrahteter Fetch befüllt eine Query

Ein Inject triggert die Query; ein `function` gibt einen Wert als
`msg.ui.query.data` zurück; ein an `query:message` gebundener `ui-text` zeigt
ihn. Eine statische Zeile hält die Seite vor dem Fetch nicht leer.

Flow-Datei: [`examples/guide/ui-query.json`](../../../../examples/guide/ui-query.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-query.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideQuery/` öffnen — die Query-Zeile
   zeigt „Loaded via ui-query", sobald der verdrahtete Fetch zurückkommt.

## Verwandt

- [Displaying data](../guides/displaying-data.md) — die Query-Schleife, Tabellen, Listen
- [`ui-query-action`](ui-query-action.md) — Query refreshen / replacen (Referenz/Wire)
- [`ui-store`](ui-store.md) — eigener veränderbarer Zustand (Abgrenzung)
- Contract-Doc (intern, Deutsch): `docs/nodes/state/ui-query.md`
