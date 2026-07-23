# ui-store-read

Liest den aktuellen Wert eines `ui-store` on demand — ein nicht-mutierender
Getter für den Backend-Flow.

> English: [../../nodes/ui-store-read.md](../../nodes/ui-store-read.md)

## Zweck

`ui-store-read` liest einen [`ui-store`](ui-store.md) **on demand**: er
referenziert einen Store per ID und emittiert bei jeder Input-Message dessen
aktuellen Wert (ganzes Slice oder Teil-Pfad). Er ist **nicht-mutierend** und
per-client — für Backend-Zugriffe (Persistieren / Export / Sync) ohne
Boilerplate und ohne Fan-out-Nadelöhr auf den Store-Knoten. Das ist der
**Referenz**-Stil: den Store picken statt an ihn zu verdrahten (Wire vs. Referenz
siehe [Actions & Events](../guides/actions-events.md)).

## Wann einsetzen

- Den aktuellen Wert eines Stores im Flow greifen (persistieren, exportieren,
  synchronisieren).
- Ein Feld über einen Teil-Pfad lesen; leerer Pfad = ganzes Slice.
- Nicht zum Ändern — das ist [`ui-store-action`](ui-store-action.md); nicht zum
  Anzeigen — das ist ein `state` / `store`-Binding an einem View.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor. | Freitext | `Store Read N` |
| **App** | Die besitzende `ui-app` (app-gebundener Referenz-Knoten). Pflicht. | App-Referenz | — |
| **Store** | Der zu lesende `ui-store`, aus dem Store-Picker (der auch implizite Query-Params-Ziele listet). Pflicht. | Store-Referenz | — |
| **Default Path** (`path`) | Default-Teil-Pfad im Slice (eine Ebene, relativ zum `statePath`). Leer = ganzes Slice. Zur Laufzeit überschreibbar. | Teil-Pfad | leer |

## Eingang

Jede Input-Message triggert einen Read. **Pfad-Präzedenz:** `msg.ui.store.path`
› `msg.path` › Config-**Default Path** › ganzes Slice. **Per-Client:** mit
`msg.ui.clientId` liest er den per-client-Zustand (sonst broadcast). Die
Scope-Regel des Stores gilt (`client-only` ohne `clientId` oder `broadcast-only`
mit einer ist ein `server.store.scope-violation`) — bei einer Verletzung ist der
Read ein No-op (keine Emission). Fehler: `server.store.read-missing-store`,
`server.store.scope-violation`, `server.store.no-active-app` — je ein
strukturiertes `done(error)` ohne Emission.

## Ausgänge / Events

Bei erfolgreichem Read:

```
msg.payload   = <Wert>   // ganzes Slice oder Teilwert
msg.ui.store  = { id, event: "read", path, fullPath, value, clientId }
```

## Beispiele

### 1. Einen Store per Trigger lesen

Ein Inject triggert einen `ui-store-read` eines vorbefüllten Stores; der
gelesene Wert erscheint in einem Debug-Knoten. Die App-Seite zeigt den
Store-Wert per `state`-Binding.

Flow-Datei: [`examples/guide/ui-store-read.json`](../../../../examples/guide/ui-store-read.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-store-read.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideStoreRead/` öffnen, dann das Inject
   klicken und den gelesenen Wert im Debug-Sidebar beobachten.

## Verwandt

- [`ui-store`](ui-store.md) — der gelesene Store
- [`ui-store-action`](ui-store-action.md) — Store mutieren (Referenz/Wire)
- [Actions & Events](../guides/actions-events.md) — Wire vs. Referenz
- Contract-Doc (intern, Deutsch): `docs/nodes/state/ui-store-read.md`
