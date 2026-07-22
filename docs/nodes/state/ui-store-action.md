# ui-store-action

> **Status:** implementiert (P211, [ADR 0029](../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md)).
> Vier-Datei-Muster: `nodes/state/ui-store-action.{js,html}`, Schema-Vertrag in
> `packages/schema` (`uiStoreActionNodeDefinitionSchema`), Registrierung + Runtime-
> Handler (`storeActionInputHandler`) in `nodes/webapp.js`. 1 Input, 1 Output.

Typisierter, referenz-basierter **Mutations-Knoten** für einen
[`ui-store`](ui-store.md): referenziert einen Store per ID und löst bei jedem
Input eine Schreib-Operation (`set`/`patch`/`delete`/`replace`/`reset`) aus —
statt `msg.ui.store = {…}` von Hand zu bauen. Zwei Modi (immer beide verfügbar,
`mode` spiegelt `ui-action.targetMode`): **reference** wendet die Op direkt
server-seitig an, **wire** emittiert das Kommando-Envelope zum Verdrahten.

## Felder

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor (Default: „Store Action N"). Keine Laufzeit-Wirkung. |
| `store` | „Store" | Node-Picker (Preset Stores) | **ja** | Referenz auf den zu mutierenden `ui-store` (Knoten-ID). |
| `op` | „Operation" | Select | **ja** | `set` \| `patch` \| `delete` \| `replace` \| `reset`. Default `set`. Op-Semantik siehe unten. |
| `path` | „Path" | Textfeld | optional | Sub-Pfad im Slice (eine Ebene, relativ zum `statePath`, [ADR 0013](../../adr/0013-store-binding-subpath.md)). Leer = ganzes Slice (statePath-Root). Zur Laufzeit überschreibbar. |
| `mode` | „Mode" | Select | **ja** | `reference` (direkt anwenden) \| `wire` (Envelope emittieren). Default `reference`. |
| `app` | „App" | Node-Picker (Apps) | **ja** | Besitzende `ui-app` (app-gebundener Referenz-Knoten, P205). Leer = Deploy-Fehler. |

## Op-Semantik

Identisch zu `ui-store` (`applyStoreOperation`):

| Wert | Editor-Typ | Wirkung | Wert-Quelle |
|---|---|---|---|
| `set` | Op | schreibt den Wert an `path` (leer = ganzes Slice) | `msg.payload` |
| `patch` | Op | Deep-Merge des Werts an `path` | `msg.payload` |
| `delete` | Op | löscht den Teilbaum an `path` | — |
| `replace` | Op | ersetzt das **ganze** Slice am `statePath` | `msg.payload` |
| `reset` | Op | setzt das Slice auf den `initialValue` des Stores zurück | — (**ignoriert** den Wert) |

`set`/`patch`/`replace` benötigen einen Wert aus `msg.payload`; fehlt er
(`undefined`), ist das ein strukturierter `server.store.invalid-operation`-Fehler.
`delete`/`reset` brauchen keinen Wert.

## Pfad-Präzedenz

`msg.ui.store.path` › `msg.path` › Config-`path` › (leer = ganzes Slice am
`statePath`). Exakt wie [`ui-store-read`](ui-store-read.md).

## Modi

- **`reference`** (Default): jede Input-Message wendet die Op **direkt**,
  server-seitig, auf den referenzierten Store an — per-client über
  `msg.ui.clientId` (Scope-Regel wie beim Schreiben: `client-only` ohne clientId
  → `server.store.scope-violation`), persistiert den neuen Zustand und pusht einen
  frischen Snapshot (SSE-Re-Render), sodass ein an den Store gebundener View live
  aktualisiert. **Kein Wire** zum `ui-store` nötig. Der Out-Port emittiert die
  `changed`-Notification (`msg.ui.store = { id, event:"changed", op, path, fullPath,
  value, previousValue, origin, clientId }`).
- **`wire`**: der Knoten mutiert **nicht**; er emittiert am Out-Port
  `msg.ui.store = { id, op, path, value }` (Wert aus `msg.payload`), das der Flow
  an den `ui-store` (oder einen Dispatcher) verdrahtet, welcher die Op anwendet.

## Per-Client & Scope

Mit `msg.ui.clientId` mutiert `reference`-Mode den per-client-Zustand (sonst
broadcast). Scope-Regel wie beim Schreiben über `ui-store`:
`broadcast-only` + clientId → Scope-Fehler; `client-only` ohne clientId →
Scope-Fehler. Beides `server.store.scope-violation`.

## Fehler-Codes (reference-Mode)

| Code | Auslöser |
|---|---|
| `server.store.action-missing-store` | referenzierter Store nicht im Registry gefunden |
| `server.store.scope-violation` | Scope-Regel verletzt (siehe oben) |
| `server.store.invalid-operation` | `set`/`patch`/`replace` ohne Wert (`msg.payload` undefined) |
| `server.store.no-active-app` | keine aktive `ui-app` registriert |
| `server.store.operation-failed` | `applyStoreOperation` warf einen Fehler |

## Output

```
// reference-Mode (nach der Mutation):
msg.ui.store = { id, event: "changed", op, path, fullPath, value, previousValue, origin, clientId }

// wire-Mode (Kommando, keine Mutation):
msg.ui.store = { id, op, path, value }
```

## Abgrenzung

- [`ui-store`](ui-store.md) — **hält** Zustand: schreibt über sein eigenes
  Input-Protokoll (`msg.ui.store`) und emittiert den `changed`-Stream. Der
  `wire`-Mode dieses Knotens speist genau dieses Protokoll.
- [`ui-store-read`](ui-store-read.md) — **liest** Zustand on demand (Getter,
  nicht-mutierend).
- `ui-store-action` — **mutiert** Zustand (dieser Knoten): typisierte Op-Auswahl,
  ohne `msg.ui.store` von Hand zu bauen.
