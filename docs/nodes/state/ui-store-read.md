# ui-store-read

> **Status:** implementiert (P209, [ADR 0028](../../adr/0028-store-reads-are-a-separate-reference-node.md)).
> Vier-Datei-Muster: `nodes/state/ui-store-read.{js,html}`, Schema-Vertrag in
> `packages/schema` (`uiStoreReadNodeDefinitionSchema`), Registrierung + Runtime-
> Handler (`storeReadInputHandler`) in `nodes/webapp.js`. 1 Input, 1 Output.

On-Demand-Leser eines [`ui-store`](ui-store.md): referenziert einen Store per ID
und emittiert dessen aktuellen Zustand (ganz oder als Teil-Pfad) bei jedem Input.
Nicht-mutierend, per-client, beliebig oft platzierbar — für Backend-Zugriffe
(Persistieren/Export/Sync) ohne Boilerplate und ohne Fan-out-Nadelöhr auf
`ui-store`.

## Felder

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor (Default: „Store Read N"). Keine Laufzeit-Wirkung. |
| `store` | „Store" | Node-Picker (Preset Stores) | **ja** | Referenz auf den zu lesenden `ui-store` (Knoten-ID). |
| `path` | „Path" | Textfeld | optional | Default-Sub-Pfad im Slice (eine Ebene, relativ zum `statePath`). Leer = ganzes Slice. |
| `parent` | „App" | Node-Picker (Apps) | **ja** | Besitzende `ui-app` (app-gebundener Referenz-Knoten, P205). |

## Verhalten

- **Input:** jede Message triggert einen Read.
- **Pfad-Präzedenz:** `msg.ui.store.path` › `msg.path` › Config-`path` › ganzes Slice.
- **Per-Client:** liest den per-client-Zustand zu `msg.ui.clientId` (sonst broadcast).
  Scope-Regel wie beim Schreiben: `client-only` ohne clientId → Scope-Fehler.
- **Nicht-mutierend:** keine State-Änderung, kein Snapshot-Push.

## Output

```
msg.payload = <Wert>                 // ganzes Slice oder Teilwert
msg.ui.store = { id, event: "read", path, fullPath, value, clientId }
```

## Abgrenzung

- [`ui-store`](ui-store.md) — hält Zustand: schreiben (Input) + `changed`-Stream (Output).
- `ui-store-read` — liest Zustand on demand (dieser Knoten).
- [`ui-query`](ui-query.md) — **externe**, server-geladene Daten (read-only im UI),
  nicht der eigene Client-Zustand.
