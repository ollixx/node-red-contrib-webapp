# ui-store-action

Mutiert einen `ui-store` über eine typisierte Operation — Store und Op picken,
statt `msg.ui.store` von Hand zu bauen.

> English: [../../nodes/ui-store-action.md](../../nodes/ui-store-action.md)

## Zweck

`ui-store-action` ist ein typisierter, referenz-basierter **Mutations-Knoten**
für einen [`ui-store`](ui-store.md): er referenziert einen Store per ID und löst
bei jedem Input eine Schreib-Op (`set` / `patch` / `delete` / `replace` /
`reset`) aus — statt `msg.ui.store = {…}` von Hand zu bauen. Zwei Modi:
**reference** wendet die Op direkt server-seitig an (Live-Re-Render, kein Wire
zum Store); **wire** emittiert das Kommando-Envelope zum Verdrahten. Das ist die
Referenz-vs-Wire-Wahl — siehe [Actions & Events](../guides/actions-events.md).

## Wann einsetzen

- Einen Store aus dem Flow mit einer klaren, typisierten Op ändern.
- **reference**-Mode für den Normalfall (direkt anwenden, kein Wire).
- **wire**-Mode, wenn du das Envelope im Flow willst (an einen Store oder
  Dispatcher). Zum Lesen statt Schreiben → [`ui-store-read`](ui-store-read.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor. | Freitext | `Store Action N` |
| **App** | Die besitzende `ui-app`. Pflicht. | App-Referenz | — |
| **Store** | Der zu mutierende `ui-store`, aus dem Store-Picker. Pflicht. | Store-Referenz | — |
| **Operation** (`op`) | Die Schreib-Op. `set` / `patch` / `replace` nehmen ihren Wert aus `msg.payload`; `delete` / `reset` keinen. | `set` / `patch` / `delete` / `replace` / `reset` | `set` |
| **Path** (`path`) | Teil-Pfad im Slice (eine Ebene, relativ zum `statePath`). Leer = ganzes Slice. Zur Laufzeit überschreibbar. | Teil-Pfad | leer |
| **Mode** (`mode`) | `reference` wendet die Op direkt server-seitig an und pusht einen Snapshot; `wire` emittiert das Envelope ohne zu mutieren. | `reference` / `wire` | `reference` |

## Op-Semantik

| `op` | Wirkung | Wert-Quelle |
|---|---|---|
| `set` | schreibt den Wert an `path` (leer = ganzes Slice) | `msg.payload` |
| `patch` | Deep-Merge an `path` | `msg.payload` |
| `delete` | löscht den Teilbaum an `path` | — |
| `replace` | ersetzt das **ganze** Slice | `msg.payload` |
| `reset` | setzt das Slice auf den `initialValue` des Stores zurück | — (ignoriert den Wert) |

Pfad-Präzedenz: `msg.ui.store.path` › `msg.path` › Config-`path` › ganzes Slice.

## Eingang

Jede Input-Message führt die Op aus. **Wert:** `set`/`patch`/`replace` brauchen
einen Wert in `msg.payload` (fehlt → `server.store.invalid-operation`).
**Per-Client:** `msg.ui.clientId` mutiert den per-client-Zustand (sonst
broadcast); die Scope-Regel des Stores gilt (`client-only` ohne / `broadcast-only`
mit `clientId` → `server.store.scope-violation`).

**Fehler-Codes (reference-Mode):**

| Code | Auslöser |
|---|---|
| `server.store.action-missing-store` | referenzierter Store nicht im Registry |
| `server.store.scope-violation` | Scope-Regel verletzt |
| `server.store.invalid-operation` | `set`/`patch`/`replace` ohne Wert |
| `server.store.no-active-app` | keine aktive `ui-app` registriert |
| `server.store.operation-failed` | `applyStoreOperation` warf einen Fehler |

## Ausgänge / Events

```
// reference-Mode (nach der Mutation):
msg.ui.store = { id, event: "changed", op, path, fullPath, value, previousValue, origin, clientId }

// wire-Mode (Kommando, keine Mutation):
msg.ui.store = { id, op, path, value }
```

## Beispiele

### 1. Einen Store-Wert aus dem Flow setzen (reference-Mode)

Ein Inject mit Payload triggert eine `ui-store-action` (`set`), die den Store
direkt schreibt; ein an den Store gebundener `ui-text` zeigt den neuen Wert live.

Flow-Datei: [`examples/guide/ui-store-action.json`](../../../../examples/guide/ui-store-action.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-store-action.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideStoreAction/` öffnen — es zeigt
   „idle"; das Inject klicken und der Text wird „active".

## Verwandt

- [`ui-store`](ui-store.md) — der mutierte Store
- [`ui-store-read`](ui-store-read.md) — einen Store lesen
- [Actions & Events](../guides/actions-events.md) — Wire vs. Referenz
- Contract-Doc (intern, Deutsch): `docs/nodes/state/ui-store-action.md`
