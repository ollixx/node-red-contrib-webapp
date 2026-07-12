# ui-store-action

> **Status:** geplant (P211, [ADR 0029](../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md)).
> Diese Spec ist der Vertrags-Rahmen; P211 füllt Feld-Details/Validierung/Beispiele.

Typisierter Mutations-Knoten für einen [`ui-store`](ui-store.md): referenziert
einen Store und wendet eine Op an — hybrid, wahlweise **direkt** (reference) oder
per **Out-Port-Envelope** (wire).

## Felder
| Feld | Editor | Pflicht | Beschreibung |
|---|---|---|---|
| `store` | Node-Picker (Stores) | **ja** | Ziel-`ui-store`. |
| `op` | Select | **ja** | `set` / `patch` / `delete` / `replace` / `reset`. |
| `path` | Textfeld | optional | Sub-Pfad (eine Ebene, rel. `statePath`). Override: `msg.ui.store.path` › `msg.path` › config. |
| `mode` | Select | **ja** | `reference` (direkt anwenden) \| `wire` (Envelope emittieren). |
| `parent` | Node-Picker (Apps) | **ja** | Besitzende App (P205). |

## Verhalten
- **reference:** wendet die Op server-seitig direkt an (per-client via `msg.ui.clientId`, Scope-Regel wie Schreiben, SSE-Re-Render). Kein Wire zum Store.
- **wire:** emittiert `msg.ui.store = { id, op, path, value }` am Out-Port.
- Wert aus `msg.payload` (set/patch/replace); `reset` ohne Wert.

## Abgrenzung
- [`ui-store`](ui-store.md) — hält Zustand (Input-Protokoll + changed-Stream).
- [`ui-store-read`](ui-store-read.md) — liest (Getter).
- `ui-store-action` — mutiert (dieser Knoten).
