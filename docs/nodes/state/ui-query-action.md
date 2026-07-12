# ui-query-action

> **Status:** geplant (P212, [ADR 0029](../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md)).
> Diese Spec ist der Vertrags-Rahmen; P212 füllt Feld-Details/Validierung/Beispiele.

Typisierter Trigger für einen [`ui-query`](ui-query.md): referenziert eine Query
und löst eine Action aus — hybrid, wahlweise **direkt** (reference) oder per
**Out-Port-Envelope** (wire).

## Felder
| Feld | Editor | Pflicht | Beschreibung |
|---|---|---|---|
| `query` | Node-Picker (Queries) | **ja** | Ziel-`ui-query`. |
| `action` | Select | **ja** | `refresh` (erweiterbar). |
| `mode` | Select | **ja** | `reference` (direkt triggern) \| `wire` (Envelope emittieren). |
| `parent` | Node-Picker (Apps) | **ja** | Besitzende App (P205). |

## Verhalten
- **reference:** triggert die Query direkt (`fireQueryRefresh`) → deren Out-Port feuert den Retrieval; per-client. Kein Wire.
- **wire:** emittiert `msg.ui.query = { queryPath, refresh: true, params }` am Out-Port.
- Optional Params aus `msg.payload`.

## Abgrenzung
- [`ui-query`](ui-query.md) — Datenhalter + Trigger via Input/`refreshAction`.
- `ui-query-action` — eigenständiger Trigger-Knoten (dieser).
